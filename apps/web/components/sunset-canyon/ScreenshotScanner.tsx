'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight, Trash2, Images, SkipForward, ArrowRight } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { Commander, fetchCommanders } from '@/lib/sunset-canyon/commanders';
import { CommanderDropdown } from './CommanderDropdown';
import {
  findByTitle,
  findBySpecialties,
  findByAltName,
  CommanderReference
} from '@/lib/sunset-canyon/commander-reference';

interface DetectedCommander {
  name: string;
  level: number;
  stars: number;
  skillLevels: number[];
  confidence: number;
  matchedCommander: Commander | null;
  imageIndex: number;
  status: 'pending' | 'accepted' | 'skipped';
}

interface ImageItem {
  src: string;
  processed: boolean;
  error?: string;
}

interface ScreenshotScannerProps {
  onImport: (commanders: { commander: Commander; level: number; skillLevels: number[]; stars: number }[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'scan' | 'verify';

export function ScreenshotScanner({ onImport, onClose }: ScreenshotScannerProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<DetectedCommander[]>([]);
  const [currentVerifyIndex, setCurrentVerifyIndex] = useState(0);
  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [isLoadingCommanders, setIsLoadingCommanders] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function loadCommanders() {
      setIsLoadingCommanders(true);
      const data = await fetchCommanders();
      setCommanders(data);
      setIsLoadingCommanders(false);
    }
    loadCommanders();
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newImages: ImageItem[] = [];
    let loadedCount = 0;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push({
          src: e.target?.result as string,
          processed: false,
        });
        loadedCount++;

        if (loadedCount === imageFiles.length) {
          setImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to convert CommanderReference to Commander from database
  const refToCommander = (ref: CommanderReference): Commander | null => {
    return commanders.find(c =>
      c.name.toLowerCase() === ref.name.toLowerCase() ||
      c.id === ref.id
    ) || null;
  };

  const matchCommander = (text: string): Commander | null => {
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const noSpaceText = normalizedText.replace(/\s/g, '');

    // Title matching
    const titleMatch = findByTitle(normalizedText);
    if (titleMatch) {
      const commander = refToCommander(titleMatch);
      if (commander) return commander;
    }

    // Direct name matching
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      const commanderNoSpace = commanderName.replace(/[\s-]/g, '');

      if (normalizedText.includes(commanderName)) return commander;
      if (noSpaceText.includes(commanderNoSpace)) return commander;
    }

    // Alt names
    const altNameMatch = findByAltName(normalizedText);
    if (altNameMatch) {
      const commander = refToCommander(altNameMatch);
      if (commander) return commander;
    }

    // Partial name matching
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      const nameParts = commanderName.split(/[\s-]+/).filter(p => p.length >= 3);

      if (nameParts.length >= 2) {
        const matchedParts = nameParts.filter(part => normalizedText.includes(part));
        if (matchedParts.length >= 2) return commander;
        for (const part of nameParts) {
          if (part.length >= 6 && normalizedText.includes(part)) return commander;
        }
      } else if (nameParts.length === 1 && nameParts[0].length >= 5) {
        if (normalizedText.includes(nameParts[0])) return commander;
      }
    }

    // Specialty matching
    const specialtyMatches = findBySpecialties(normalizedText);
    if (specialtyMatches.length === 1) {
      const commander = refToCommander(specialtyMatches[0]);
      if (commander) return commander;
    }

    return null;
  };

  const parseCommanderInfo = (text: string, imageIndex: number): DetectedCommander | null => {
    const matched = matchCommander(text);

    // Extract level
    let level = 60;
    const levelMatch = text.match(/(?:lv\.?|level)\s*(\d{1,2})/i) || text.match(/\b(\d{1,2})\s*(?:lv|level)/i);
    if (levelMatch) {
      const parsed = parseInt(levelMatch[1]);
      if (parsed >= 1 && parsed <= 60) level = parsed;
    }

    // Extract stars
    let stars = 5;
    const starMatch = text.match(/(\d)\s*(?:star|★)/i);
    if (starMatch) {
      const parsed = parseInt(starMatch[1]);
      if (parsed >= 1 && parsed <= 5) stars = parsed;
    }

    // Extract skills
    let skillLevels = [5, 5, 5, 5];
    const skillMatch = text.match(/(\d)\/(\d)\/(\d)\/(\d)/);
    if (skillMatch) {
      skillLevels = [
        Math.min(5, parseInt(skillMatch[1])),
        Math.min(5, parseInt(skillMatch[2])),
        Math.min(5, parseInt(skillMatch[3])),
        Math.min(5, parseInt(skillMatch[4])),
      ];
    }

    return {
      name: matched?.name || text.slice(0, 50),
      level,
      stars,
      skillLevels,
      confidence: matched ? 0.8 : 0.3,
      matchedCommander: matched,
      imageIndex,
      status: 'pending',
    };
  };

  const processAllImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const worker = await createWorker('eng');
    const newDetected: DetectedCommander[] = [];

    for (let i = 0; i < images.length; i++) {
      if (images[i].processed) continue;

      setProcessingIndex(i);
      setProgress(((i + 1) / images.length) * 100);

      try {
        const { data: { text } } = await worker.recognize(images[i].src);
        const info = parseCommanderInfo(text, i);
        if (info) {
          newDetected.push(info);
        }

        setImages(prev => prev.map((img, idx) =>
          idx === i ? { ...img, processed: true } : img
        ));
      } catch (error) {
        console.error(`Failed to process image ${i}:`, error);
        setImages(prev => prev.map((img, idx) =>
          idx === i ? { ...img, processed: true, error: 'Failed to process' } : img
        ));
      }
    }

    await worker.terminate();
    setDetected(newDetected);
    setIsProcessing(false);
    setProcessingIndex(null);
    setCurrentVerifyIndex(0);

    if (newDetected.length > 0) {
      setStep('verify');
    }
  };

  const updateCurrentCommander = (field: string, value: unknown) => {
    setDetected(prev => prev.map((d, i) =>
      i === currentVerifyIndex ? { ...d, [field]: value } : d
    ));
  };

  const acceptCurrent = () => {
    setDetected(prev => prev.map((d, i) =>
      i === currentVerifyIndex ? { ...d, status: 'accepted' } : d
    ));
    goToNext();
  };

  const skipCurrent = () => {
    setDetected(prev => prev.map((d, i) =>
      i === currentVerifyIndex ? { ...d, status: 'skipped' } : d
    ));
    goToNext();
  };

  const goToNext = () => {
    if (currentVerifyIndex < detected.length - 1) {
      setCurrentVerifyIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentVerifyIndex > 0) {
      setCurrentVerifyIndex(prev => prev - 1);
    }
  };

  const handleImport = () => {
    const toImport = detected
      .filter(d => d.status === 'accepted' && d.matchedCommander)
      .map(d => ({
        commander: d.matchedCommander!,
        level: d.level,
        skillLevels: d.skillLevels,
        stars: d.stars,
      }));

    onImport(toImport);
    onClose();
  };

  const acceptedCount = detected.filter(d => d.status === 'accepted' && d.matchedCommander).length;
  const pendingCount = detected.filter(d => d.status === 'pending').length;
  const currentCommander = detected[currentVerifyIndex];
  const isLastOne = currentVerifyIndex === detected.length - 1;
  const allReviewed = pendingCount === 0;

  if (isLoadingCommanders) {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      <canvas ref={canvasRef} className="hidden" />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 overflow-hidden flex flex-col">

        {/* Header with steps */}
        <div className="p-4 border-b border-stone-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-amber-500">Screenshot Scanner</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {['upload', 'scan', 'verify'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  step === s
                    ? 'bg-amber-600 text-stone-900 font-semibold'
                    : i < ['upload', 'scan', 'verify'].indexOf(step)
                    ? 'bg-green-600/30 text-green-400'
                    : 'bg-stone-700 text-stone-500'
                }`}>
                  <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                    {i < ['upload', 'scan', 'verify'].indexOf(step) ? '✓' : i + 1}
                  </span>
                  <span className="capitalize">{s}</span>
                </div>
                {i < 2 && <ArrowRight className="w-4 h-4 text-stone-600 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-stone-600 hover:border-amber-600'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-amber-500/50 mx-auto mb-3" />
                <p className="text-stone-300 mb-1">Drop commander screenshots here</p>
                <p className="text-stone-500 text-sm mb-4">or click to browse</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChange}
                  className="hidden"
                  id="screenshot-upload"
                />
                <label
                  htmlFor="screenshot-upload"
                  className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold cursor-pointer hover:from-amber-500 hover:to-amber-600 transition-all"
                >
                  <Images className="w-4 h-4 inline mr-2" />
                  Select Images
                </label>
              </div>

              {/* Uploaded images preview */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-stone-400">
                    {images.length} image{images.length !== 1 ? 's' : ''} ready to scan
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={img.src}
                          alt={`Upload ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-stone-600"
                        />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 p-1 rounded bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Scanning */}
          {step === 'scan' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-stone-300 text-lg mb-2">
                Scanning image {(processingIndex ?? 0) + 1} of {images.length}
              </p>
              <p className="text-stone-500 text-sm mb-4">
                Reading text with OCR...
              </p>
              <div className="w-64 h-2 bg-stone-700 rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Verify - One at a time */}
          {step === 'verify' && currentCommander && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-400">
                  Commander {currentVerifyIndex + 1} of {detected.length}
                </span>
                <span className="text-green-400">
                  {acceptedCount} accepted
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${((currentVerifyIndex + 1) / detected.length) * 100}%` }}
                />
              </div>

              {/* Large image preview */}
              <div className="relative bg-stone-900 rounded-xl overflow-hidden">
                {images[currentCommander.imageIndex] && (
                  <img
                    src={images[currentCommander.imageIndex].src}
                    alt="Commander screenshot"
                    className="w-full max-h-[300px] object-contain"
                  />
                )}

                {/* Status badge */}
                {currentCommander.status !== 'pending' && (
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium ${
                    currentCommander.status === 'accepted'
                      ? 'bg-green-600 text-white'
                      : 'bg-stone-600 text-stone-300'
                  }`}>
                    {currentCommander.status === 'accepted' ? '✓ Accepted' : 'Skipped'}
                  </div>
                )}
              </div>

              {/* Commander form */}
              <div className={`p-4 rounded-xl border ${
                currentCommander.matchedCommander
                  ? 'bg-stone-800/50 border-stone-600'
                  : 'bg-yellow-900/20 border-yellow-600/30'
              }`}>

                {/* Commander dropdown */}
                <div className="mb-4">
                  <label className="text-sm text-stone-400 block mb-1.5">Commander</label>
                  <CommanderDropdown
                    commanders={commanders}
                    value={currentCommander.matchedCommander}
                    onChange={(cmd) => updateCurrentCommander('matchedCommander', cmd)}
                    placeholder={currentCommander.name || 'Select commander...'}
                  />
                  {!currentCommander.matchedCommander && (
                    <p className="text-xs text-yellow-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      OCR couldn&apos;t match - select manually
                    </p>
                  )}
                </div>

                {/* Row 1: Level & Stars */}
                <div className="flex gap-3 mb-3">
                  {/* Level - dropdown style */}
                  <div className="flex-1">
                    <label className="text-xs text-stone-500 block mb-1">Level</label>
                    <select
                      value={currentCommander.level}
                      onChange={(e) => updateCurrentCommander('level', parseInt(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:border-amber-500 focus:outline-none appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2378716c'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '20px' }}
                    >
                      {[60, 50, 40, 37, 30, 27, 20, 10, 1].map((lvl) => (
                        <option key={lvl} value={lvl}>Lv. {lvl}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stars */}
                  <div className="flex-1">
                    <label className="text-xs text-stone-500 block mb-1">Stars</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateCurrentCommander('stars', s)}
                          className={`flex-1 h-10 rounded-lg text-lg transition-all active:scale-95 ${
                            s <= currentCommander.stars
                              ? 'bg-yellow-500/30 text-yellow-500'
                              : 'bg-stone-700 text-stone-600'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2: Skills - full width */}
                <div>
                  <label className="text-xs text-stone-500 block mb-1">
                    Skills <span className="text-stone-600">(tap to cycle 0-5)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((skillIdx) => (
                      <button
                        key={skillIdx}
                        onClick={() => {
                          const newSkills = [...currentCommander.skillLevels];
                          const current = newSkills[skillIdx] ?? 0;
                          newSkills[skillIdx] = current >= 5 ? 0 : current + 1;
                          updateCurrentCommander('skillLevels', newSkills);
                        }}
                        className={`flex flex-col items-center py-3 rounded-xl border-2 transition-all active:scale-95 ${
                          currentCommander.skillLevels[skillIdx] === 5
                            ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500'
                            : currentCommander.skillLevels[skillIdx] === 0
                            ? 'bg-stone-800 border-stone-700 text-stone-500'
                            : 'bg-stone-700 border-stone-600 text-stone-200'
                        }`}
                      >
                        <span className="text-2xl font-bold">{currentCommander.skillLevels[skillIdx] ?? 0}</span>
                        <span className="text-[10px] text-stone-500 mt-0.5">Skill {skillIdx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons - Fun and satisfying */}
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  disabled={currentVerifyIndex === 0}
                  className="group px-4 py-3 rounded-xl border-2 border-stone-600 text-stone-400 hover:border-stone-500 hover:bg-stone-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="font-medium">Back</span>
                </button>

                <button
                  onClick={skipCurrent}
                  className="group px-5 py-3 rounded-xl border-2 border-orange-500/30 bg-orange-500/10 text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/20 transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <SkipForward className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  <span className="font-medium">Skip</span>
                </button>

                <button
                  onClick={acceptCurrent}
                  disabled={!currentCommander.matchedCommander}
                  className="group flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:from-green-400 hover:to-emerald-500 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <Check className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>{isLastOne ? 'Accept & Finish!' : 'Accept'}</span>
                  {!isLastOne && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </div>
          )}

          {/* All reviewed summary */}
          {step === 'verify' && allReviewed && (
            <div className="mt-6 p-4 rounded-xl bg-stone-800/50 border border-stone-600">
              <h3 className="text-lg font-semibold text-amber-500 mb-2">Review Complete</h3>
              <p className="text-stone-400 mb-4">
                {acceptedCount} commander{acceptedCount !== 1 ? 's' : ''} ready to import
              </p>

              {acceptedCount > 0 && (
                <div className="space-y-2 mb-4">
                  {detected.filter(d => d.status === 'accepted' && d.matchedCommander).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className={d.matchedCommander?.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'}>
                        {d.matchedCommander?.name}
                      </span>
                      <span className="text-stone-500">Lv.{d.level} {'★'.repeat(d.stars)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-700 flex justify-between">
          {step === 'upload' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStep('scan');
                  processAllImages();
                }}
                disabled={images.length === 0}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2"
              >
                <Scan className="w-4 h-4" />
                Scan {images.length} Image{images.length !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <button
                onClick={() => {
                  setStep('upload');
                  setDetected([]);
                  setImages([]);
                }}
                className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={acceptedCount === 0}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Import {acceptedCount} Commander{acceptedCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
