'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight, Images, SkipForward, ArrowRight, Shield } from 'lucide-react';
import equipmentData from '@/data/equipment.json';
import { processImageWithOCR } from '@/lib/ocr-utils';

interface Equipment {
  id: string;
  name: string;
  type: string;
  rarity: string;
  requiredLevel: number;
  stats: Record<string, number>;
  set: string | null;
  description: string;
}

interface DetectedEquipment {
  name: string;
  rarity: string;
  type: string;
  confidence: number;
  matchedEquipment: Equipment | null;
  imageIndex: number;
  status: 'pending' | 'accepted' | 'skipped';
  originalOcrText?: string;
}

interface ImageItem {
  src: string;
  processed: boolean;
  error?: string;
}

interface EquipmentScannerProps {
  onClose: () => void;
  onImport?: (equipment: Equipment[]) => void;
}

type Step = 'upload' | 'scan' | 'verify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const equipment: Equipment[] = (equipmentData.equipment as any[]).map(e => ({
  ...e,
  stats: Object.fromEntries(
    Object.entries(e.stats).filter(([, v]) => v !== undefined)
  ) as Record<string, number>
}));

export function EquipmentScanner({ onClose, onImport }: EquipmentScannerProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<DetectedEquipment[]>([]);
  const [currentVerifyIndex, setCurrentVerifyIndex] = useState(0);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');

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

  const matchEquipment = (text: string): Equipment | null => {
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Try exact match first
    for (const eq of equipment) {
      const eqName = eq.name.toLowerCase();
      if (normalizedText.includes(eqName)) return eq;
    }

    // Try partial matching
    for (const eq of equipment) {
      const words = eq.name.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
      const matchCount = words.filter(word => normalizedText.includes(word)).length;
      if (matchCount >= 2 || (words.length === 1 && matchCount === 1)) {
        return eq;
      }
    }

    return null;
  };

  const detectRarity = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('legendary')) return 'legendary';
    if (lower.includes('epic')) return 'epic';
    if (lower.includes('elite')) return 'elite';
    if (lower.includes('advanced')) return 'advanced';
    return 'normal';
  };

  const detectType = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('weapon') || lower.includes('sword') || lower.includes('staff') || lower.includes('axe')) return 'weapon';
    if (lower.includes('helm') || lower.includes('helmet') || lower.includes('mask')) return 'helm';
    if (lower.includes('armor') || lower.includes('chest') || lower.includes('robe')) return 'chest';
    if (lower.includes('glove') || lower.includes('grip') || lower.includes('cuff')) return 'gloves';
    if (lower.includes('boot') || lower.includes('greave')) return 'boots';
    if (lower.includes('ring') || lower.includes('accessory') || lower.includes('necklace')) return 'accessory';
    return 'unknown';
  };

  const parseEquipmentInfo = (text: string, imageIndex: number): DetectedEquipment => {
    const matched = matchEquipment(text);
    const rarity = matched?.rarity || detectRarity(text);
    const type = matched?.type || detectType(text);

    return {
      name: matched?.name || text.slice(0, 50),
      rarity,
      type,
      confidence: matched ? 0.8 : 0.3,
      matchedEquipment: matched,
      imageIndex,
      status: 'pending',
      originalOcrText: text,
    };
  };

  const processAllImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const newDetected: DetectedEquipment[] = [];

    for (let i = 0; i < images.length; i++) {
      if (images[i].processed) continue;

      setProcessingIndex(i);
      setProgress(((i + 1) / images.length) * 100);

      try {
        // Use preprocessed OCR for better accuracy
        const text = await processImageWithOCR(images[i].src);

        const info = parseEquipmentInfo(text, i);
        newDetected.push(info);

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

  const updateCurrentEquipment = (equipmentId: string) => {
    const eq = equipment.find(e => e.id === equipmentId);
    if (eq) {
      setDetected(prev => prev.map((d, i) =>
        i === currentVerifyIndex ? { ...d, matchedEquipment: eq, name: eq.name, rarity: eq.rarity, type: eq.type } : d
      ));
    }
    setSelectedEquipmentId(equipmentId);
  };

  useEffect(() => {
    const current = detected[currentVerifyIndex];
    if (current?.matchedEquipment) {
      setSelectedEquipmentId(current.matchedEquipment.id);
    } else {
      setSelectedEquipmentId('');
    }
  }, [currentVerifyIndex, detected]);

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
      .filter(d => d.status === 'accepted' && d.matchedEquipment)
      .map(d => d.matchedEquipment!);

    if (onImport) {
      onImport(toImport);
    }
    onClose();
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-[#ffb547] bg-[#ffb547]/20';
      case 'epic': return 'text-[#9f7aea] bg-[#9f7aea]/20';
      case 'elite': return 'text-[#21d4fd] bg-[#0075ff]/20';
      case 'advanced': return 'text-[#01b574] bg-[#01b574]/20';
      default: return 'text-[#a0aec0] bg-[#a0aec0]/20';
    }
  };

  const acceptedCount = detected.filter(d => d.status === 'accepted' && d.matchedEquipment).length;
  const pendingCount = detected.filter(d => d.status === 'pending').length;
  const currentEquipment = detected[currentVerifyIndex];
  const isLastOne = currentVerifyIndex === detected.length - 1;
  const allReviewed = pendingCount === 0;

  // Group equipment by type for the dropdown
  const equipmentByType = equipment.reduce((acc, eq) => {
    if (!acc[eq.type]) acc[eq.type] = [];
    acc[eq.type].push(eq);
    return acc;
  }, {} as Record<string, Equipment[]>);

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] rounded-xl bg-[rgba(6,11,40,0.98)] border border-white/10 backdrop-blur-xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#0075ff]" />
              <h2 className="text-lg font-semibold text-[#21d4fd]">Equipment Scanner</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#ffb547]/20 text-[#ffb547]">Beta</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1a1f3c] transition-colors">
              <X className="w-5 h-5 text-[#a0aec0]" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {['upload', 'scan', 'verify'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  step === s
                    ? 'bg-[#0075ff] text-white font-semibold'
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
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive ? 'border-[#0075ff] bg-[#0075ff]/10' : 'border-white/10 hover:border-[#0075ff]'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-[#0075ff]/50 mx-auto mb-3" />
                <p className="text-white mb-1">Drop equipment screenshots here</p>
                <p className="text-[#718096] text-sm mb-4">Screenshot your equipment screen from the blacksmith</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChange}
                  className="hidden"
                  id="equipment-screenshot-upload"
                />
                <label
                  htmlFor="equipment-screenshot-upload"
                  className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-[#0075ff] to-[#0055cc] text-white font-semibold cursor-pointer hover:from-[#0080ff] hover:to-[#0065dd] transition-all"
                >
                  <Images className="w-4 h-4 inline mr-2" />
                  Select Images
                </label>
              </div>

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

          {step === 'scan' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-[#0075ff] animate-spin mx-auto mb-4" />
              <p className="text-white text-lg mb-2">
                Scanning image {(processingIndex ?? 0) + 1} of {images.length}
              </p>
              <p className="text-[#718096] text-sm mb-4">Reading equipment information...</p>
              <div className="w-64 h-2 bg-[#1a1f3c] rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-[#0075ff] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {step === 'verify' && currentEquipment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a0aec0]">
                  Equipment {currentVerifyIndex + 1} of {detected.length}
                </span>
                <span className="text-[#01b574]">{acceptedCount} accepted</span>
              </div>

              <div className="h-1 bg-[#1a1f3c] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0075ff] transition-all"
                  style={{ width: `${((currentVerifyIndex + 1) / detected.length) * 100}%` }}
                />
              </div>

              <div className="relative bg-[#0a0d1f] rounded-xl overflow-hidden">
                {images[currentEquipment.imageIndex] && (
                  <img
                    src={images[currentEquipment.imageIndex].src}
                    alt="Equipment screenshot"
                    className="w-full max-h-[300px] object-contain"
                  />
                )}
              </div>

              <div className={`p-4 rounded-xl border ${
                currentEquipment.matchedEquipment
                  ? 'bg-[rgba(6,11,40,0.5)] border-white/10'
                  : 'bg-[#ffb547]/10 border-[#ffb547]/30'
              }`}>
                <div className="mb-4">
                  <label className="text-sm text-[#a0aec0] block mb-1.5">Equipment</label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => updateCurrentEquipment(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#1a1f3c] border border-white/10 text-white focus:border-[#0075ff] focus:outline-none"
                  >
                    <option value="">Select equipment...</option>
                    {Object.entries(equipmentByType).map(([type, items]) => (
                      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                        {items.map(eq => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name} ({eq.rarity})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {!currentEquipment.matchedEquipment && (
                    <p className="text-xs text-[#ffb547] mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Could not auto-detect - please select manually
                    </p>
                  )}
                </div>

                {currentEquipment.matchedEquipment && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRarityColor(currentEquipment.rarity)}`}>
                        {currentEquipment.rarity}
                      </span>
                      <span className="text-xs text-[#718096] capitalize">{currentEquipment.type}</span>
                    </div>
                    <div className="text-sm text-[#a0aec0]">
                      {currentEquipment.matchedEquipment.description}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(currentEquipment.matchedEquipment.stats).map(([stat, value]) => (
                        <span key={stat} className="px-2 py-1 rounded bg-[#1a1f3c] text-xs text-white">
                          {stat.replace(/([A-Z])/g, ' $1').trim()}: +{value}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  disabled={currentVerifyIndex === 0}
                  className="px-4 py-3 rounded-xl border-2 border-white/10 text-[#a0aec0] disabled:opacity-30 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>

                <button
                  onClick={skipCurrent}
                  className="px-5 py-3 rounded-xl border-2 border-[#ffb547]/30 bg-[#ffb547]/10 text-[#ffb547] transition-all flex items-center gap-2"
                >
                  <SkipForward className="w-5 h-5" />
                  Skip
                </button>

                <button
                  onClick={acceptCurrent}
                  disabled={!currentEquipment.matchedEquipment}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#01b574] to-[#00a86b] text-white font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  <Check className="w-6 h-6" />
                  {isLastOne ? 'Accept & Finish!' : 'Accept'}
                </button>
              </div>
            </div>
          )}

          {step === 'verify' && allReviewed && (
            <div className="mt-6 p-4 rounded-xl bg-[rgba(6,11,40,0.5)] border border-white/10">
              <h3 className="text-lg font-semibold text-[#21d4fd] mb-2">Review Complete</h3>
              <p className="text-[#a0aec0] mb-4">
                {acceptedCount} equipment piece{acceptedCount !== 1 ? 's' : ''} ready to save
              </p>
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
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#0075ff] to-[#0055cc] text-white font-semibold disabled:opacity-50 transition-all flex items-center gap-2"
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
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#0075ff] to-[#0055cc] text-white font-semibold disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save {acceptedCount} Equipment
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
