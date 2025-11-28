'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight, Trash2, Images } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { Commander, fetchCommanders } from '@/lib/sunset-canyon/commanders';
import { 
  commanderReferences, 
  findByTitle, 
  findBySpecialties, 
  findByAltName,
  CommanderReference 
} from '@/lib/sunset-canyon/commander-reference';
import {
  extractDominantColors,
  matchByDominantColors,
} from '@/lib/sunset-canyon/image-fingerprint';

interface DetectedCommander {
  name: string;
  level: number;
  stars: number;
  skillLevels: number[];
  confidence: number;
  matchedCommander: Commander | null;
  imageIndex: number;
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

export function ScreenshotScanner({ onImport, onClose }: ScreenshotScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<DetectedCommander[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
    
    // ===== STRATEGY 1: TITLE MATCHING (most reliable with OCR) =====
    // Titles like "The Immortal Hammer", "Conqueror of Istanbul" are often more readable
    const titleMatch = findByTitle(normalizedText);
    if (titleMatch) {
      const commander = refToCommander(titleMatch);
      if (commander) {
        console.log(`[OCR Match] Found by title: "${titleMatch.title}" -> ${commander.name}`);
        return commander;
      }
    }
    
    // ===== STRATEGY 2: DIRECT NAME MATCHING =====
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      const commanderNoSpace = commanderName.replace(/[\s-]/g, '');
      
      // Direct match
      if (normalizedText.includes(commanderName)) {
        console.log(`[OCR Match] Direct name match: ${commander.name}`);
        return commander;
      }
      
      // No-space match
      if (noSpaceText.includes(commanderNoSpace)) {
        console.log(`[OCR Match] No-space match: ${commander.name}`);
        return commander;
      }
    }
    
    // ===== STRATEGY 3: ALT NAMES FROM REFERENCE =====
    const altNameMatch = findByAltName(normalizedText);
    if (altNameMatch) {
      const commander = refToCommander(altNameMatch);
      if (commander) {
        console.log(`[OCR Match] Found by alt name: ${commander.name}`);
        return commander;
      }
    }
    
    // ===== STRATEGY 4: PARTIAL NAME MATCHING =====
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      const nameParts = commanderName.split(/[\s-]+/).filter(p => p.length >= 3);
      
      // Multi-part name matching
      if (nameParts.length >= 2) {
        const matchedParts = nameParts.filter(part => normalizedText.includes(part));
        if (matchedParts.length >= 2) {
          console.log(`[OCR Match] Multi-part match (${matchedParts.join(', ')}): ${commander.name}`);
          return commander;
        }
        // Single unique part (6+ chars)
        for (const part of nameParts) {
          if (part.length >= 6 && normalizedText.includes(part)) {
            console.log(`[OCR Match] Unique part match (${part}): ${commander.name}`);
            return commander;
          }
        }
      } else if (nameParts.length === 1 && nameParts[0].length >= 5) {
        if (normalizedText.includes(nameParts[0])) {
          console.log(`[OCR Match] Single name match: ${commander.name}`);
          return commander;
        }
      }
      
      // Strip Roman numerals for matching
      const nameWithoutNumeral = commanderName.replace(/\s+(i{1,3}|iv|v|vi{0,3})$/i, '').trim();
      if (nameWithoutNumeral !== commanderName && nameWithoutNumeral.length >= 4) {
        if (normalizedText.includes(nameWithoutNumeral)) {
          console.log(`[OCR Match] Without numeral match: ${commander.name}`);
          return commander;
        }
      }
    }
    
    // ===== STRATEGY 5: OCR VARIATIONS =====
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      
      const ocrVariations: string[] = [
        commanderName.replace(/l/g, 'i'),
        commanderName.replace(/i/g, 'l'),
        commanderName.replace(/l/g, '1'),
        commanderName.replace(/o/g, '0'),
        commanderName.replace(/(.)\1/g, '$1'),
        commanderName.replace(/ö/g, 'o'),
        commanderName.replace(/'/g, ''),
        commanderName.replace(/æ/g, 'ae'),
        commanderName.replace(/ð/g, 'd'),
      ];
      
      for (const variation of ocrVariations) {
        if (variation !== commanderName && normalizedText.includes(variation)) {
          console.log(`[OCR Match] OCR variation match: ${commander.name}`);
          return commander;
        }
      }
    }
    
    // ===== STRATEGY 6: SPECIALTY TAG MATCHING =====
    const specialtyMatches = findBySpecialties(normalizedText);
    if (specialtyMatches.length === 1) {
      // Unique match by specialties
      const commander = refToCommander(specialtyMatches[0]);
      if (commander) {
        console.log(`[OCR Match] Unique specialty match: ${commander.name}`);
        return commander;
      }
    } else if (specialtyMatches.length > 1) {
      // Multiple matches - try to narrow down with partial name
      for (const ref of specialtyMatches) {
        const firstName = ref.name.split(/[\s-]/)[0].toLowerCase();
        if (firstName.length >= 3 && normalizedText.includes(firstName.substring(0, 3))) {
          const commander = refToCommander(ref);
          if (commander) {
            console.log(`[OCR Match] Specialty + partial name: ${commander.name}`);
            return commander;
          }
        }
      }
    }
    
    // ===== STRATEGY 7: SPECIFIC PATTERNS FOR PROBLEM NAMES =====
    // These are commanders that consistently fail OCR
    const problemPatterns: Array<{ pattern: RegExp; name: string }> = [
      // Mehmed II
      { pattern: /\bmeh\w{0,4}d?\b/i, name: 'Mehmed II' },
      { pattern: /conqueror.*istanbul/i, name: 'Mehmed II' },
      
      // Charles Martel - CRITICAL: Check for Infantry+Garrison+Defense tags
      { pattern: /immortal.*hammer/i, name: 'Charles Martel' },
      { pattern: /\bmart[eaio]l?\b/i, name: 'Charles Martel' },
      { pattern: /infantry.*garrison.*defense/i, name: 'Charles Martel' },
      { pattern: /garrison.*defense.*infantry/i, name: 'Charles Martel' },
      
      // Scipio Africanus
      { pattern: /blades.*warfare/i, name: 'Scipio Africanus' },
      { pattern: /\bscip\w{0,3}\b/i, name: 'Scipio Africanus' },
      
      // Baibars - OCR reads as "Baingy" or "Baiing"
      { pattern: /father.*conquest/i, name: 'Baibars' },
      { pattern: /\bbaib\w{0,4}\b/i, name: 'Baibars' },
      { pattern: /\bbaiing\b/i, name: 'Baibars' },
      { pattern: /\bbaingy\b/i, name: 'Baibars' },
      { pattern: /\bbai[bn]g/i, name: 'Baibars' },
      
      // Thutmose III - title is "Beloved of Thoth", specialties: Archer/Versatility/Support
      { pattern: /beloved.*thoth/i, name: 'Thutmose III' },
      { pattern: /beloved/i, name: 'Thutmose III' },
      { pattern: /\bthut/i, name: 'Thutmose III' },
      { pattern: /\bthoth/i, name: 'Thutmose III' },
      { pattern: /thotm/i, name: 'Thutmose III' },
      { pattern: /tutmos/i, name: 'Thutmose III' },
      { pattern: /archer.*versatility.*support/i, name: 'Thutmose III' },
      { pattern: /versatility.*support.*archer/i, name: 'Thutmose III' },
      
      // Osman I
      { pattern: /imperial.*pioneer/i, name: 'Osman I' },
      { pattern: /\bosma\w{0,2}\b/i, name: 'Osman I' },
      
      // Björn Ironside
      { pattern: /king.*kattegat/i, name: 'Björn Ironside' },
      { pattern: /\bbjor\w{0,2}\b/i, name: 'Björn Ironside' },
      { pattern: /\biron\s*side\b/i, name: 'Björn Ironside' },
      
      // Sun Tzu
      { pattern: /tactical.*genius/i, name: 'Sun Tzu' },
      
      // Boudica
      { pattern: /celtic.*rose/i, name: 'Boudica' },
      
      // Lohar
      { pattern: /roaring.*barbarian/i, name: 'Lohar' },
      
      // Kusunoki Masashige
      { pattern: /bushido.*spirit/i, name: 'Kusunoki Masashige' },
      
      // Minamoto no Yoshitsune
      { pattern: /kamakura.*warlord/i, name: 'Minamoto no Yoshitsune' },
      
      // Wak Chanil Ajaw
      { pattern: /lady.*six.*sky/i, name: 'Wak Chanil Ajaw' },
      { pattern: /\bwak\s*chan/i, name: 'Wak Chanil Ajaw' },
      
      // Æthelflæd - OCR reads as "Athelfiad", "Athelliad", etc. DB has "Aethelflaed"
      { pattern: /lady.*mercians/i, name: 'Aethelflaed' },
      { pattern: /athelf[il]a/i, name: 'Aethelflaed' },
      { pattern: /aethelf/i, name: 'Aethelflaed' },
      { pattern: /thelfla/i, name: 'Aethelflaed' },
    ];
    
    for (const { pattern, name } of problemPatterns) {
      if (pattern.test(normalizedText)) {
        const commander = commanders.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (commander) {
          console.log(`[OCR Match] Problem pattern match (${pattern}): ${commander.name}`);
          return commander;
        }
      }
    }
    
    return null;
  };

  const countStars = (imageData: ImageData, width: number, height: number): number => {
    const startX = Math.floor(width * 0.55);
    const endX = Math.floor(width * 0.85);
    const startY = Math.floor(height * 0.20);
    const endY = Math.floor(height * 0.35);
    
    let goldPixelClusters = 0;
    
    for (let y = startY; y < endY; y += 3) {
      let inGoldRegion = false;
      let rowClusters = 0;
      
      for (let x = startX; x < endX; x++) {
        const i = (y * width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        const isGold = r > 180 && g > 140 && g < 220 && b < 100 && r > g;
        const isBrightYellow = r > 200 && g > 180 && b < 120 && r > b * 2;
        
        if (isGold || isBrightYellow) {
          if (!inGoldRegion) {
            inGoldRegion = true;
            rowClusters++;
          }
        } else {
          inGoldRegion = false;
        }
      }
      
      if (rowClusters > goldPixelClusters) {
        goldPixelClusters = rowClusters;
      }
    }
    
    return Math.max(1, Math.min(5, goldPixelClusters));
  };

  const extractLevelFromRegion = (text: string): number => {
    const levelPatterns = [
      /level\s*(\d{1,2})/i,
      /lv\.?\s*(\d{1,2})/i,
      /lvl\.?\s*(\d{1,2})/i,
      /(\d{1,2})\s*\/\s*\d{2}/,
    ];
    
    for (const pattern of levelPatterns) {
      const match = text.match(pattern);
      if (match) {
        const level = parseInt(match[1]);
        if (level >= 1 && level <= 60) {
          return level;
        }
      }
    }
    
    return 60;
  };

  const extractSkillLevels = (text: string): number[] => {
    const digits = text.match(/\b[1-5]\b/g);
    if (digits && digits.length >= 4) {
      return digits.slice(0, 4).map(d => parseInt(d));
    }
    
    const skillPattern = /([1-5])\s*[\/\s,]\s*([1-5])\s*[\/\s,]\s*([1-5])\s*[\/\s,]\s*([1-5])/;
    const match = text.match(skillPattern);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
    }
    
    return [5, 5, 5, 5];
  };

  const analyzeImage = async (imgSrc: string): Promise<{ stars: number; imageData: ImageData | null }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          resolve({ stars: 5, imageData: null });
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ stars: 5, imageData: null });
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const stars = countStars(imageData, img.width, img.height);
        
        resolve({ stars, imageData });
      };
      img.onerror = () => resolve({ stars: 5, imageData: null });
      img.src = imgSrc;
    });
  };

  const processSingleImage = async (imageIndex: number): Promise<DetectedCommander | null> => {
    const image = images[imageIndex];
    if (!image || image.processed) return null;

    try {
      const { stars: detectedStars, imageData } = await analyzeImage(image.src);
      
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(image.src);
      await worker.terminate();

      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const fullText = lines.join(' ');
      
      // DEBUG: Log what OCR found
      console.log(`[OCR Debug] Image ${imageIndex + 1}:`, fullText.substring(0, 200));
      
      let matchedCommander: Commander | null = null;
      for (const line of lines) {
        matchedCommander = matchCommander(line);
        if (matchedCommander) {
          console.log(`[OCR Debug] Matched "${matchedCommander.name}" from line: "${line}"`);
          break;
        }
      }
      
      if (!matchedCommander) {
        matchedCommander = matchCommander(fullText);
        if (matchedCommander) {
          console.log(`[OCR Debug] Matched "${matchedCommander.name}" from full text`);
        }
      }

      // FALLBACK: Try color-based identification if OCR failed
      if (!matchedCommander && imageData) {
        const img = new Image();
        img.src = image.src;
        await new Promise(resolve => { img.onload = resolve; });
        
        // Extract dominant colors and match against fingerprint database
        const dominantColors = extractDominantColors(imageData, img.width, img.height);
        console.log(`[Color Debug] Dominant colors:`, dominantColors);
        
        const colorMatch = matchByDominantColors(dominantColors);
        if (colorMatch) {
          matchedCommander = commanders.find(c => 
            c.name.toLowerCase() === colorMatch.commander.toLowerCase()
          ) || null;
          if (matchedCommander) {
            console.log(`[OCR Match] Color fingerprint match: ${matchedCommander.name} (${(colorMatch.confidence * 100).toFixed(1)}%)`);
          }
        }
      }

      if (!matchedCommander) {
        console.log(`[OCR Debug] No match found. Full text:`, fullText);
      }

      setImages(prev => prev.map((img, i) => 
        i === imageIndex ? { ...img, processed: true, error: matchedCommander ? undefined : 'No commander detected' } : img
      ));

      if (matchedCommander) {
        const level = extractLevelFromRegion(fullText);
        const skillLevels = extractSkillLevels(fullText);
        const finalStars = detectedStars > 0 ? detectedStars : 
          (matchedCommander.rarity === 'legendary' ? 5 : 4);
        
        return {
          name: matchedCommander.name,
          level,
          stars: finalStars,
          skillLevels,
          confidence: 0.8,
          matchedCommander,
          imageIndex,
        };
      }

      return null;
    } catch (err) {
      console.error(`[OCR Debug] Error processing image ${imageIndex + 1}:`, err);
      setImages(prev => prev.map((img, i) => 
        i === imageIndex ? { ...img, processed: true, error: 'Processing failed' } : img
      ));
      return null;
    }
  };

  const processAllImages = async () => {
    setIsProcessing(true);
    setDetected([]);
    setSelected(new Set());
    
    const newDetected: DetectedCommander[] = [];
    
    for (let i = 0; i < images.length; i++) {
      if (images[i].processed) continue;
      
      setProcessingIndex(i);
      setCurrentImageIndex(i);
      setProgress(0);
      
      const result = await processSingleImage(i);
      if (result) {
        newDetected.push(result);
      }
    }
    
    setDetected(newDetected);
    setSelected(new Set(newDetected.map((_, i) => i)));
    setProcessingIndex(null);
    setIsProcessing(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setDetected(prev => prev.filter(d => d.imageIndex !== index));
    if (currentImageIndex >= images.length - 1) {
      setCurrentImageIndex(Math.max(0, images.length - 2));
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const handleImport = () => {
    const toImport = detected
      .filter((_, i) => selected.has(i))
      .filter(d => d.matchedCommander)
      .map(d => ({
        commander: d.matchedCommander!,
        level: d.level,
        skillLevels: d.skillLevels,
        stars: d.stars,
      }));
    onImport(toImport);
  };

  const updateDetected = (index: number, field: string, value: number | number[]) => {
    setDetected(prev => prev.map((d, i) => {
      if (i !== index) return d;
      return { ...d, [field]: value };
    }));
  };

  const unprocessedCount = images.filter(img => !img.processed).length;
  const processedCount = images.filter(img => img.processed).length;

  if (isLoadingCommanders) {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-3xl rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <p className="text-stone-400">Loading commanders database...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20">
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <div>
            <h2 className="text-xl font-semibold text-amber-500">Scan Screenshots</h2>
            <p className="text-xs text-stone-400 mt-1">
              Upload multiple screenshots at once • Beta feature
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Upload area */}
          {!isProcessing && (
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all mb-4 ${
                dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-stone-600 hover:border-amber-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-10 h-10 text-amber-500/50 mx-auto mb-3" />
              <p className="text-stone-300 mb-1">Drop screenshots here or click to browse</p>
              <p className="text-stone-500 text-sm mb-3">Select multiple files at once</p>
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
          )}

          {/* Image thumbnails */}
          {images.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider">
                  Screenshots ({images.length})
                </h3>
                {processedCount > 0 && (
                  <span className="text-xs text-stone-400">
                    {processedCount} processed, {unprocessedCount} remaining
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      currentImageIndex === i 
                        ? 'border-amber-500' 
                        : img.processed 
                          ? img.error 
                            ? 'border-red-500/50' 
                            : 'border-green-500/50'
                          : 'border-stone-600'
                    } ${processingIndex === i ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-stone-900' : ''}`}
                    onClick={() => setCurrentImageIndex(i)}
                  >
                    <img src={img.src} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    
                    {img.processed && (
                      <div className={`absolute inset-0 flex items-center justify-center ${
                        img.error ? 'bg-red-900/60' : 'bg-green-900/60'
                      }`}>
                        {img.error ? (
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        ) : (
                          <Check className="w-6 h-6 text-green-400" />
                        )}
                      </div>
                    )}
                    
                    {processingIndex === i && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                    )}
                    
                    {!isProcessing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(i);
                        }}
                        className="absolute top-1 right-1 p-1 rounded bg-stone-900/80 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3 text-stone-400" />
                      </button>
                    )}
                    
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-stone-900/80 text-xs text-stone-300">
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current image preview */}
          {images.length > 0 && images[currentImageIndex] && (
            <div className="mb-4">
              <div className="relative rounded-lg overflow-hidden bg-stone-900">
                <img 
                  src={images[currentImageIndex].src} 
                  alt="Current screenshot" 
                  className="w-full h-auto max-h-[200px] object-contain" 
                />
                
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                      disabled={currentImageIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-stone-900/80 hover:bg-stone-700 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5 text-stone-300" />
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1))}
                      disabled={currentImageIndex === images.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-stone-900/80 hover:bg-stone-700 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-5 h-5 text-stone-300" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Scan button */}
          {images.length > 0 && unprocessedCount > 0 && !isProcessing && (
            <button
              onClick={processAllImages}
              className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all flex items-center justify-center gap-2 mb-4"
            >
              <Scan className="w-5 h-5" />
              Scan {unprocessedCount} Screenshot{unprocessedCount !== 1 ? 's' : ''} for Commanders
            </button>
          )}

          {/* Processing status */}
          {isProcessing && (
            <div className="text-center py-4 mb-4 rounded-lg bg-stone-800/50">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
              <p className="text-stone-300">
                Processing image {(processingIndex ?? 0) + 1} of {images.length}...
              </p>
              <div className="w-48 h-2 bg-stone-700 rounded-full mx-auto mt-3 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Detected commanders */}
          {detected.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider">
                Detected Commanders ({detected.length})
              </h3>
              <p className="text-xs text-stone-400">Click to select/deselect. Edit values if needed.</p>
              
              {detected.map((d, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border transition-all ${
                    selected.has(i)
                      ? 'bg-green-900/20 border-green-500/50'
                      : 'bg-stone-800/50 border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSelection(i)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selected.has(i) ? 'bg-green-500 text-white' : 'bg-stone-700 text-stone-500'
                      }`}
                    >
                      {selected.has(i) && <Check className="w-4 h-4" />}
                    </button>
                    
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        d.matchedCommander?.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                      }`}>
                        {d.name}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setCurrentImageIndex(d.imageIndex)}
                      className="text-xs text-stone-500 hover:text-amber-500"
                    >
                      img #{d.imageIndex + 1}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <label className="text-xs text-stone-500">Level</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={d.level}
                        onChange={(e) => updateDetected(i, 'level', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 rounded bg-stone-700 border border-stone-600 text-stone-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">Stars</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={d.stars}
                        onChange={(e) => updateDetected(i, 'stars', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 rounded bg-stone-700 border border-stone-600 text-stone-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">Skills</label>
                      <input
                        type="text"
                        value={d.skillLevels.join('/')}
                        onChange={(e) => {
                          const parts = e.target.value.split('/').map(s => parseInt(s) || 1);
                          while (parts.length < 4) parts.push(1);
                          updateDetected(i, 'skillLevels', parts.slice(0, 4).map(n => Math.min(5, Math.max(1, n))));
                        }}
                        placeholder="5/5/5/5"
                        className="w-full px-2 py-1 rounded bg-stone-700 border border-stone-600 text-stone-200 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error summary */}
          {processedCount > 0 && images.some(img => img.error) && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-medium">Some images failed</p>
              </div>
              <p className="text-sm text-stone-400">
                {images.filter(img => img.error).length} screenshot(s) could not be processed. 
                Try clearer screenshots or add commanders manually.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 p-4 border-t border-stone-700">
          <button
            onClick={() => {
              setImages([]);
              setDetected([]);
              setSelected(new Set());
            }}
            disabled={images.length === 0 || isProcessing}
            className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
            >
              Cancel
            </button>
            {detected.length > 0 && (
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 hover:from-amber-500 hover:to-amber-600 transition-all"
              >
                Import {selected.size} Commander{selected.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
