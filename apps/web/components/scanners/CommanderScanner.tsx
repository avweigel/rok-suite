'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight, Images, SkipForward, ArrowRight, Zap } from 'lucide-react';
import { Commander, fetchCommanders } from '@/lib/sunset-canyon/commanders';
import { CommanderDropdown } from '@/components/sunset-canyon/CommanderDropdown';
import {
  findByTitle,
  findBySpecialties,
  findByAltName,
  CommanderReference
} from '@/lib/sunset-canyon/commander-reference';
import {
  extractCommanderFromScreenshot,
  isDetectionConfigured,
  type CommanderDetection,
} from '@/lib/sunset-canyon/roboflow-detect';
import { processImageWithOCR } from '@/lib/ocr-utils';

interface DetectedCommander {
  name: string;
  level: number;
  stars: number;
  skillLevels: number[];
  confidence: number;
  matchedCommander: Commander | null;
  imageIndex: number;
  status: 'pending' | 'accepted' | 'skipped';
  originalOcrText?: string;
  detection?: CommanderDetection;
}

interface ImageItem {
  src: string;
  processed: boolean;
  error?: string;
}

interface PreloadedCommander {
  id: string;
  name: string;
  title?: string;
  rarity: string;
  types: string[];
  level: number;
  skills: number[];
  stars?: number;
  power?: number;
  unitCapacity?: number;
}

interface CommanderScannerProps {
  onClose: () => void;
  onImport?: (commanders: { commander: Commander; level: number; skillLevels: number[]; stars: number }[]) => void;
  preloadedCommanders?: PreloadedCommander[];
}

type Step = 'upload' | 'scan' | 'verify';

export function CommanderScanner({ onClose, onImport, preloadedCommanders }: CommanderScannerProps) {
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
  const [useOcrMode, setUseOcrMode] = useState(true);
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

    const titleMatch = findByTitle(normalizedText);
    if (titleMatch) {
      const commander = refToCommander(titleMatch);
      if (commander) return commander;
    }

    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      const commanderNoSpace = commanderName.replace(/[\s-]/g, '');

      if (normalizedText.includes(commanderName)) return commander;
      if (noSpaceText.includes(commanderNoSpace)) return commander;
    }

    const altNameMatch = findByAltName(normalizedText);
    if (altNameMatch) {
      const commander = refToCommander(altNameMatch);
      if (commander) return commander;
    }

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

    const specialtyMatches = findBySpecialties(normalizedText);
    if (specialtyMatches.length === 1) {
      const commander = refToCommander(specialtyMatches[0]);
      if (commander) return commander;
    }

    return null;
  };

  const parseCommanderInfo = (text: string, imageIndex: number): DetectedCommander | null => {
    const matched = matchCommander(text);

    let level = 60;
    const levelMatch = text.match(/(?:lv\.?|level)\s*(\d{1,2})/i) || text.match(/\b(\d{1,2})\s*(?:lv|level)/i);
    if (levelMatch) {
      const parsed = parseInt(levelMatch[1]);
      if (parsed >= 1 && parsed <= 60) level = parsed;
    }

    let stars = 5;
    const starMatch = text.match(/(\d)\s*(?:star|★)/i);
    if (starMatch) {
      const parsed = parseInt(starMatch[1]);
      if (parsed >= 1 && parsed <= 5) stars = parsed;
    }

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
      originalOcrText: text,
    };
  };

  const processAllImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const newDetected: DetectedCommander[] = [];
    const useRoboflow = !useOcrMode && isDetectionConfigured();

    for (let i = 0; i < images.length; i++) {
      if (images[i].processed) continue;

      setProcessingIndex(i);
      setProgress(((i + 1) / images.length) * 100);

      try {
        if (useRoboflow) {
          const result = await extractCommanderFromScreenshot(images[i].src);

          if (result) {
            const info = parseCommanderInfo(result.detectedName, i);
            if (info) {
              info.stars = result.starCount > 0 ? Math.min(6, result.starCount) : info.stars;
              info.skillLevels = result.skillCount > 0
                ? Array(4).fill(0).map((_, idx) => idx < result.skillCount ? 5 : 0)
                : info.skillLevels;
              info.confidence = result.confidence;
              info.detection = result.detection;
              newDetected.push(info);
            }
          } else {
            newDetected.push({
              name: 'Unknown Commander',
              level: 60,
              stars: 5,
              skillLevels: [5, 5, 5, 5],
              confidence: 0,
              matchedCommander: null,
              imageIndex: i,
              status: 'pending',
              originalOcrText: '',
            });
          }
        } else {
          // Use preprocessed OCR for better accuracy
          const text = await processImageWithOCR(images[i].src);

          const info = parseCommanderInfo(text, i);
          if (info) {
            newDetected.push(info);
          }
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

    if (onImport) {
      onImport(toImport);
    }
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
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg rounded-xl bg-[rgba(6,11,40,0.98)] backdrop-blur-xl border border-white/10 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#ffb547] animate-spin" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      <canvas ref={canvasRef} className="hidden" />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] rounded-xl bg-[rgba(6,11,40,0.98)] backdrop-blur-xl border border-white/10 overflow-hidden flex flex-col">

        {/* Header with steps */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#ffb547]">Commander Scanner</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1a1f3c] transition-colors">
              <X className="w-5 h-5 text-[#a0aec0]" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {['upload', 'scan', 'verify'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  step === s
                    ? 'bg-[#ffb547] text-[#0f1535] font-semibold'
                    : i < ['upload', 'scan', 'verify'].indexOf(step)
                    ? 'bg-[#01b574]/30 text-[#01b574]'
                    : 'bg-[#1a1f3c] text-[#718096]'
                }`}>
                  <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                    {i < ['upload', 'scan', 'verify'].indexOf(step) ? '✓' : i + 1}
                  </span>
                  <span className="capitalize">{s}</span>
                </div>
                {i < 2 && <ArrowRight className="w-4 h-4 text-[#718096] mx-1" />}
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
                  dragActive ? 'border-[#ffb547] bg-[#ffb547]/10' : 'border-white/10 hover:border-[#ffb547]'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-[#ffb547]/50 mx-auto mb-3" />
                <p className="text-white mb-1">Drop commander screenshots here</p>
                <p className="text-[#718096] text-sm mb-4">or click to browse</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChange}
                  className="hidden"
                  id="commander-screenshot-upload"
                />
                <label
                  htmlFor="commander-screenshot-upload"
                  className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-[#ffb547] to-[#e5a03f] text-[#0f1535] font-semibold cursor-pointer hover:from-[#ffc05a] hover:to-[#ffb547] transition-all"
                >
                  <Images className="w-4 h-4 inline mr-2" />
                  Select Images
                </label>
              </div>

              {/* Scan mode toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(6,11,40,0.5)] border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#a0aec0]">Scan mode:</span>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    <button
                      onClick={() => setUseOcrMode(true)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        useOcrMode
                          ? 'bg-[#ffb547] text-[#0f1535]'
                          : 'bg-[#1a1f3c] text-[#a0aec0] hover:bg-[#252b4d]'
                      }`}
                    >
                      OCR (Stable)
                    </button>
                    <button
                      onClick={() => setUseOcrMode(false)}
                      disabled={!isDetectionConfigured()}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        !useOcrMode && isDetectionConfigured()
                          ? 'bg-[#ffb547] text-[#0f1535]'
                          : isDetectionConfigured()
                          ? 'bg-[#1a1f3c] text-[#a0aec0] hover:bg-[#252b4d]'
                          : 'bg-[#1a1f3c] text-[#718096] cursor-not-allowed'
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      AI (Beta)
                    </button>
                  </div>
                </div>
                <span className="text-xs text-[#718096]">
                  {useOcrMode ? 'Uses Tesseract OCR' : 'Uses Roboflow AI'}
                </span>
              </div>

              {/* Uploaded images preview */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#a0aec0]">
                    {images.length} image{images.length !== 1 ? 's' : ''} ready to scan
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={img.src}
                          alt={`Upload ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-white/10"
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
              <div className="relative w-12 h-12 mx-auto mb-4">
                <Loader2 className="w-12 h-12 text-[#ffb547] animate-spin" />
                {!useOcrMode && isDetectionConfigured() && (
                  <Zap className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              <p className="text-white text-lg mb-2">
                Scanning image {(processingIndex ?? 0) + 1} of {images.length}
              </p>
              <p className="text-[#718096] text-sm mb-4">
                {!useOcrMode && isDetectionConfigured()
                  ? 'AI detecting commander elements...'
                  : 'Reading text with OCR...'}
              </p>
              <div className="w-64 h-2 bg-[#1a1f3c] rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-[#ffb547] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Verify */}
          {step === 'verify' && currentCommander && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a0aec0]">
                  Commander {currentVerifyIndex + 1} of {detected.length}
                </span>
                <span className="text-[#01b574]">
                  {acceptedCount} accepted
                </span>
              </div>

              <div className="h-1 bg-[#1a1f3c] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffb547] transition-all"
                  style={{ width: `${((currentVerifyIndex + 1) / detected.length) * 100}%` }}
                />
              </div>

              <div className="relative bg-[#0a0d1f] rounded-xl overflow-hidden">
                {images[currentCommander.imageIndex] && (
                  <img
                    src={images[currentCommander.imageIndex].src}
                    alt="Commander screenshot"
                    className="w-full max-h-[300px] object-contain"
                  />
                )}

                {currentCommander.status !== 'pending' && (
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium ${
                    currentCommander.status === 'accepted'
                      ? 'bg-[#01b574] text-white'
                      : 'bg-stone-600 text-white'
                  }`}>
                    {currentCommander.status === 'accepted' ? '✓ Accepted' : 'Skipped'}
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-xl border ${
                currentCommander.matchedCommander
                  ? 'bg-[rgba(6,11,40,0.5)] border-white/10'
                  : 'bg-[#ffb547]/10 border-[#ffb547]/30'
              }`}>

                <div className="mb-4">
                  <label className="text-sm text-[#a0aec0] block mb-1.5">Commander</label>
                  <CommanderDropdown
                    commanders={commanders}
                    value={currentCommander.matchedCommander}
                    onChange={(cmd) => updateCurrentCommander('matchedCommander', cmd)}
                    placeholder={currentCommander.name || 'Select commander...'}
                  />
                  {!currentCommander.matchedCommander && (
                    <p className="text-xs text-[#ffb547] mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      OCR couldn&apos;t match - select manually
                    </p>
                  )}
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-[#718096] block mb-1">Level (1-60)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={currentCommander.level}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        updateCurrentCommander('level', Math.max(1, Math.min(60, val)));
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#1a1f3c] border border-white/10 text-white focus:border-[#ffb547] focus:outline-none"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-xs text-[#718096] block mb-1">Stars</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateCurrentCommander('stars', s)}
                          className={`flex-1 h-10 rounded-lg text-lg transition-all active:scale-95 ${
                            s <= currentCommander.stars
                              ? 'bg-[#ffb547]/30 text-[#ffb547]'
                              : 'bg-[#1a1f3c] text-[#718096]'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#718096] block mb-1">
                    Skills <span className="text-[#718096]">(tap to cycle 0-5)</span>
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
                            ? 'bg-[#ffb547]/20 border-[#ffb547]/50 text-[#ffb547]'
                            : currentCommander.skillLevels[skillIdx] === 0
                            ? 'bg-[#1a1f3c] border-white/10 text-[#718096]'
                            : 'bg-[#1a1f3c] border-white/10 text-white'
                        }`}
                      >
                        <span className="text-2xl font-bold">{currentCommander.skillLevels[skillIdx] ?? 0}</span>
                        <span className="text-[10px] text-[#718096] mt-0.5">Skill {skillIdx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  disabled={currentVerifyIndex === 0}
                  className="group px-4 py-3 rounded-xl border-2 border-white/10 text-[#a0aec0] hover:border-stone-500 hover:bg-[#1a1f3c]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-medium">Back</span>
                </button>

                <button
                  onClick={skipCurrent}
                  className="group px-5 py-3 rounded-xl border-2 border-[#ffb547]/30 bg-[#ffb547]/10 text-[#ffb547] hover:border-[#ffb547]/50 hover:bg-[#ffb547]/20 transition-all duration-200 flex items-center gap-2"
                >
                  <SkipForward className="w-5 h-5" />
                  <span className="font-medium">Skip</span>
                </button>

                <button
                  onClick={acceptCurrent}
                  disabled={!currentCommander.matchedCommander}
                  className="group flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#01b574] to-[#00a86b] text-white font-bold text-lg shadow-lg shadow-[#01b574]/25 disabled:opacity-50 disabled:cursor-not-allowed hover:from-[#02c982] hover:to-[#01b574] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <Check className="w-6 h-6" />
                  <span>{isLastOne ? 'Accept & Finish!' : 'Accept'}</span>
                  {!isLastOne && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {/* All reviewed summary */}
          {step === 'verify' && allReviewed && (
            <div className="mt-6 p-4 rounded-xl bg-[rgba(6,11,40,0.5)] border border-white/10">
              <h3 className="text-lg font-semibold text-[#ffb547] mb-2">Review Complete</h3>
              <p className="text-[#a0aec0] mb-4">
                {acceptedCount} commander{acceptedCount !== 1 ? 's' : ''} ready to import
              </p>

              {acceptedCount > 0 && (
                <div className="space-y-2 mb-4">
                  {detected.filter(d => d.status === 'accepted' && d.matchedCommander).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-[#01b574]" />
                      <span className={d.matchedCommander?.rarity === 'legendary' ? 'text-[#ffb547]' : 'text-[#9f7aea]'}>
                        {d.matchedCommander?.name}
                      </span>
                      <span className="text-[#718096]">Lv.{d.level} {'★'.repeat(d.stars)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-between">
          {step === 'upload' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-white/10 text-[#a0aec0] hover:bg-[#1a1f3c] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStep('scan');
                  processAllImages();
                }}
                disabled={images.length === 0}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#ffb547] to-[#e5a03f] text-[#0f1535] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-[#ffc05a] hover:to-[#ffb547] transition-all flex items-center gap-2"
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
                className="px-4 py-2 rounded-lg border border-white/10 text-[#a0aec0] hover:bg-[#1a1f3c] transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={acceptedCount === 0}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#ffb547] to-[#e5a03f] text-[#0f1535] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-[#ffc05a] hover:to-[#ffb547] transition-all flex items-center gap-2"
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
