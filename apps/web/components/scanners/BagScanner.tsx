'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight, Images, SkipForward, ArrowRight, Package, Plus, Minus } from 'lucide-react';
import bagItemsData from '@/data/bag-items.json';
import { processImageWithOCR } from '@/lib/ocr-utils';

interface BagItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  value?: number;
  resourceType?: string;
  speedupType?: string;
  boostType?: string;
  materialType?: string;
  description: string;
}

interface DetectedItem {
  name: string;
  quantity: number;
  category: string;
  confidence: number;
  matchedItem: BagItem | null;
  imageIndex: number;
  status: 'pending' | 'accepted' | 'skipped';
  originalOcrText?: string;
}

interface ImageItem {
  src: string;
  processed: boolean;
  error?: string;
}

interface BagScannerProps {
  onClose: () => void;
  onImport?: (items: { item: BagItem; quantity: number }[]) => void;
}

type Step = 'upload' | 'scan' | 'verify';

const bagItems: BagItem[] = bagItemsData.items as BagItem[];
const categories = bagItemsData.categories;

export function BagScanner({ onClose, onImport }: BagScannerProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [currentVerifyIndex, setCurrentVerifyIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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

  const matchBagItem = (text: string): BagItem | null => {
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Try exact match first
    for (const item of bagItems) {
      const itemName = item.name.toLowerCase();
      if (normalizedText.includes(itemName)) return item;
    }

    // Try category-based matching
    const categories = ['speedup', 'resource', 'food', 'wood', 'stone', 'gold', 'gem', 'sculpture', 'key', 'teleport'];
    for (const cat of categories) {
      if (normalizedText.includes(cat)) {
        const matches = bagItems.filter(item =>
          item.name.toLowerCase().includes(cat) ||
          item.category.toLowerCase().includes(cat)
        );
        if (matches.length === 1) return matches[0];
      }
    }

    return null;
  };

  const detectQuantity = (text: string): number => {
    // Look for common quantity patterns
    const patterns = [
      /x\s*(\d+)/i,
      /(\d+)\s*x/i,
      /×\s*(\d+)/,
      /(\d+)\s*×/,
      /quantity[:\s]*(\d+)/i,
      /(\d{1,6})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > 0 && num < 1000000) return num;
      }
    }

    return 1;
  };

  const detectCategory = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('speedup') || lower.includes('speed up')) return 'speedups';
    if (lower.includes('food') || lower.includes('wood') || lower.includes('stone') || lower.includes('gold')) return 'resources';
    if (lower.includes('gem')) return 'resources';
    if (lower.includes('sculpture')) return 'sculptures';
    if (lower.includes('key') || lower.includes('chest')) return 'keys';
    if (lower.includes('teleport')) return 'teleports';
    if (lower.includes('shield') || lower.includes('boost') || lower.includes('attack') || lower.includes('defense')) return 'boosts';
    if (lower.includes('material') || lower.includes('iron') || lower.includes('leather') || lower.includes('bone') || lower.includes('ebony')) return 'materials';
    return 'special';
  };

  const parseItemInfo = (text: string, imageIndex: number): DetectedItem => {
    const matched = matchBagItem(text);
    const quantity = detectQuantity(text);
    const category = matched?.category || detectCategory(text);

    return {
      name: matched?.name || text.slice(0, 50),
      quantity,
      category,
      confidence: matched ? 0.8 : 0.3,
      matchedItem: matched,
      imageIndex,
      status: 'pending',
      originalOcrText: text,
    };
  };

  const processAllImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const newDetected: DetectedItem[] = [];

    for (let i = 0; i < images.length; i++) {
      if (images[i].processed) continue;

      setProcessingIndex(i);
      setProgress(((i + 1) / images.length) * 100);

      try {
        // Use preprocessed OCR for better accuracy
        const text = await processImageWithOCR(images[i].src);

        const info = parseItemInfo(text, i);
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

  const updateCurrentItem = (itemId: string) => {
    const item = bagItems.find(i => i.id === itemId);
    if (item) {
      setDetected(prev => prev.map((d, i) =>
        i === currentVerifyIndex ? { ...d, matchedItem: item, name: item.name, category: item.category } : d
      ));
    }
    setSelectedItemId(itemId);
  };

  const updateQuantity = (delta: number) => {
    setDetected(prev => prev.map((d, i) =>
      i === currentVerifyIndex ? { ...d, quantity: Math.max(1, d.quantity + delta) } : d
    ));
  };

  const setQuantity = (value: number) => {
    setDetected(prev => prev.map((d, i) =>
      i === currentVerifyIndex ? { ...d, quantity: Math.max(1, value) } : d
    ));
  };

  useEffect(() => {
    const current = detected[currentVerifyIndex];
    if (current?.matchedItem) {
      setSelectedItemId(current.matchedItem.id);
      setSelectedCategory(current.matchedItem.category);
    } else if (current) {
      setSelectedItemId('');
      setSelectedCategory(current.category);
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
      .filter(d => d.status === 'accepted' && d.matchedItem)
      .map(d => ({ item: d.matchedItem!, quantity: d.quantity }));

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

  const acceptedCount = detected.filter(d => d.status === 'accepted' && d.matchedItem).length;
  const pendingCount = detected.filter(d => d.status === 'pending').length;
  const currentItem = detected[currentVerifyIndex];
  const isLastOne = currentVerifyIndex === detected.length - 1;
  const allReviewed = pendingCount === 0;

  // Filter items by selected category
  const filteredItems = selectedCategory
    ? bagItems.filter(item => item.category === selectedCategory)
    : bagItems;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] rounded-xl bg-[rgba(6,11,40,0.98)] backdrop-blur-xl border border-white/10 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#01b574]" />
              <h2 className="text-lg font-semibold text-[#01b574]">Bag Scanner</h2>
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
                    ? 'bg-[#01b574] text-white font-semibold'
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
                  dragActive ? 'border-[#01b574] bg-[#01b574]/10' : 'border-white/10 hover:border-[#01b574]'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-[#01b574]/50 mx-auto mb-3" />
                <p className="text-white mb-1">Drop bag screenshots here</p>
                <p className="text-[#718096] text-sm mb-4">Screenshot items from your inventory</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChange}
                  className="hidden"
                  id="bag-screenshot-upload"
                />
                <label
                  htmlFor="bag-screenshot-upload"
                  className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-[#01b574] to-[#00a86b] text-white font-semibold cursor-pointer hover:from-[#02c982] hover:to-[#01b574] transition-all"
                >
                  <Images className="w-4 h-4 inline mr-2" />
                  Select Images
                </label>
              </div>

              <div className="p-3 rounded-lg bg-[rgba(6,11,40,0.5)] border border-white/10">
                <h4 className="text-sm font-medium text-white mb-2">Supported Items</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <span key={cat.id} className="px-2 py-1 rounded bg-[#1a1f3c] text-xs text-[#a0aec0]">
                      {cat.name}
                    </span>
                  ))}
                </div>
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
              <Loader2 className="w-12 h-12 text-[#01b574] animate-spin mx-auto mb-4" />
              <p className="text-white text-lg mb-2">
                Scanning image {(processingIndex ?? 0) + 1} of {images.length}
              </p>
              <p className="text-[#718096] text-sm mb-4">Reading item information...</p>
              <div className="w-64 h-2 bg-[#1a1f3c] rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-[#01b574] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {step === 'verify' && currentItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a0aec0]">
                  Item {currentVerifyIndex + 1} of {detected.length}
                </span>
                <span className="text-[#01b574]">{acceptedCount} accepted</span>
              </div>

              <div className="h-1 bg-[#1a1f3c] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#01b574] transition-all"
                  style={{ width: `${((currentVerifyIndex + 1) / detected.length) * 100}%` }}
                />
              </div>

              <div className="relative bg-[#0a0d1f] rounded-xl overflow-hidden">
                {images[currentItem.imageIndex] && (
                  <img
                    src={images[currentItem.imageIndex].src}
                    alt="Bag item screenshot"
                    className="w-full max-h-[250px] object-contain"
                  />
                )}
              </div>

              <div className={`p-4 rounded-xl border ${
                currentItem.matchedItem
                  ? 'bg-[rgba(6,11,40,0.5)] border-white/10'
                  : 'bg-[#ffb547]/10 border-[#ffb547]/30'
              }`}>
                {/* Category filter */}
                <div className="mb-3">
                  <label className="text-sm text-[#a0aec0] block mb-1.5">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedItemId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1f3c] border border-white/10 text-white focus:border-[#01b574] focus:outline-none"
                  >
                    <option value="">All categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Item selector */}
                <div className="mb-4">
                  <label className="text-sm text-[#a0aec0] block mb-1.5">Item</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => updateCurrentItem(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#1a1f3c] border border-white/10 text-white focus:border-[#01b574] focus:outline-none"
                  >
                    <option value="">Select item...</option>
                    {filteredItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {!currentItem.matchedItem && (
                    <p className="text-xs text-[#ffb547] mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Could not auto-detect - please select manually
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="mb-4">
                  <label className="text-sm text-[#a0aec0] block mb-1.5">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(-10)}
                      className="px-3 py-2 rounded-lg bg-[#1a1f3c] text-white hover:bg-[#252b4d]"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => updateQuantity(-1)}
                      className="p-2 rounded-lg bg-[#1a1f3c] text-white hover:bg-[#252b4d]"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-24 px-3 py-2 rounded-lg bg-[#1a1f3c] border border-white/10 text-white text-center focus:border-[#01b574] focus:outline-none"
                    />
                    <button
                      onClick={() => updateQuantity(1)}
                      className="p-2 rounded-lg bg-[#1a1f3c] text-white hover:bg-[#252b4d]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateQuantity(10)}
                      className="px-3 py-2 rounded-lg bg-[#1a1f3c] text-white hover:bg-[#252b4d]"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {currentItem.matchedItem && (
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRarityColor(currentItem.matchedItem.rarity)}`}>
                      {currentItem.matchedItem.rarity}
                    </span>
                    <span className="text-xs text-[#718096]">{currentItem.matchedItem.description}</span>
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
                  disabled={!currentItem.matchedItem}
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
              <h3 className="text-lg font-semibold text-[#01b574] mb-2">Review Complete</h3>
              <p className="text-[#a0aec0] mb-4">
                {acceptedCount} item{acceptedCount !== 1 ? 's' : ''} ready to save
              </p>

              {acceptedCount > 0 && (
                <div className="space-y-2">
                  {detected.filter(d => d.status === 'accepted' && d.matchedItem).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-[#1a1f3c]/50 rounded px-3 py-2">
                      <span className="text-white">{d.matchedItem?.name}</span>
                      <span className="text-[#01b574] font-medium">x{d.quantity}</span>
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
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#01b574] to-[#00a86b] text-white font-semibold disabled:opacity-50 transition-all flex items-center gap-2"
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
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#01b574] to-[#00a86b] text-white font-semibold disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save {acceptedCount} Item{acceptedCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
