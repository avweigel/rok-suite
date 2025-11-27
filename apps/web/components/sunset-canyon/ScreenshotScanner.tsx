'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Scan, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { Commander, fetchCommanders } from '@/lib/sunset-canyon/commanders';

interface DetectedCommander {
  name: string;
  level: number;
  stars: number;
  skillLevels: number[];
  confidence: number;
  matchedCommander: Commander | null;
}

interface ScreenshotScannerProps {
  onImport: (commanders: { commander: Commander; level: number; skillLevels: number[]; stars: number }[]) => void;
  onClose: () => void;
}

export function ScreenshotScanner({ onImport, onClose }: ScreenshotScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<DetectedCommander[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setDetected([]);
      setSelected(new Set());
    };
    reader.readAsDataURL(file);
  };

  const matchCommander = (text: string): Commander | null => {
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      
      if (normalizedText.includes(commanderName)) {
        return commander;
      }
      
      const nameParts = commanderName.split(/[\s-]+/);
      for (const part of nameParts) {
        if (part.length >= 3 && normalizedText.includes(part)) {
          return commander;
        }
      }
      
      const variations = [
        commanderName.replace(/\s+/g, ''),
        commanderName.replace(/-/g, ' '),
      ];
      
      for (const variation of variations) {
        if (normalizedText.includes(variation)) {
          return commander;
        }
      }
    }
    return null;
  };

  // Count gold stars by analyzing pixel colors in the star region
  const countStars = (imageData: ImageData, width: number, height: number): number => {
    // Stars are typically in the upper-right area of commander profile
    // They appear as bright yellow/gold pixels
    // Approximate region: 60-80% from left, 25-35% from top
    
    const startX = Math.floor(width * 0.55);
    const endX = Math.floor(width * 0.85);
    const startY = Math.floor(height * 0.20);
    const endY = Math.floor(height * 0.35);
    
    let goldPixelClusters = 0;
    let inCluster = false;
    let clusterWidth = 0;
    
    // Scan horizontally for gold pixel clusters (each star is a cluster)
    for (let y = startY; y < endY; y++) {
      let rowClusters = 0;
      inCluster = false;
      clusterWidth = 0;
      
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        
        // Check if pixel is gold/yellow (high red, high green, low blue)
        const isGold = r > 180 && g > 150 && b < 100 && r > b + 80 && g > b + 50;
        
        if (isGold) {
          if (!inCluster) {
            inCluster = true;
            clusterWidth = 1;
          } else {
            clusterWidth++;
          }
        } else {
          if (inCluster && clusterWidth > 5) {
            rowClusters++;
          }
          inCluster = false;
          clusterWidth = 0;
        }
      }
      
      if (inCluster && clusterWidth > 5) {
        rowClusters++;
      }
      
      // Track max clusters found in any row
      if (rowClusters > goldPixelClusters) {
        goldPixelClusters = rowClusters;
      }
    }
    
    // Clamp to 1-5 range
    return Math.max(1, Math.min(5, goldPixelClusters));
  };

  // Extract level from a specific region using OCR
  const extractLevelFromRegion = (text: string): number => {
    // Look for "Level XX" or "Lv.XX" or just numbers 1-60
    const levelPatterns = [
      /level\s*(\d{1,2})/i,
      /lv\.?\s*(\d{1,2})/i,
      /lvl\.?\s*(\d{1,2})/i,
      /(\d{1,2})\s*\/\s*\d{2}/,  // "48/50" format
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
    
    return 60; // Default to max level
  };

  // Try to extract skill levels from skill region
  const extractSkillLevels = (text: string): number[] => {
    // Look for patterns like "5" near skill icons, or sequences of single digits
    const skillNumbers: number[] = [];
    
    // Look for individual digits that could be skill levels
    const digits = text.match(/\b[1-5]\b/g);
    if (digits && digits.length >= 4) {
      return digits.slice(0, 4).map(d => parseInt(d));
    }
    
    // Look for skill format like "5/5/5/5" or "5 5 5 5"
    const skillPattern = /([1-5])\s*[\/\s,]\s*([1-5])\s*[\/\s,]\s*([1-5])\s*[\/\s,]\s*([1-5])/;
    const match = text.match(skillPattern);
    if (match) {
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        parseInt(match[4]),
      ];
    }
    
    // Default to max skills for legendary, mid for epic
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
      img.onerror = () => {
        resolve({ stars: 5, imageData: null });
      };
      img.src = imgSrc;
    });
  };

  const processImage = async () => {
    if (!image) return;
    
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // First, analyze the image for stars
      setProgress(10);
      const { stars: detectedStars } = await analyzeImage(image);
      
      setProgress(20);
      
      // Then run OCR for text
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
          }
        },
      });

      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();

      setProgress(95);

      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const detectedCommanders: DetectedCommander[] = [];
      const fullText = lines.join(' ');
      
      // Find commander name
      let matchedCommander: Commander | null = null;
      for (const line of lines) {
        matchedCommander = matchCommander(line);
        if (matchedCommander) break;
      }
      
      // Also try the full text
      if (!matchedCommander) {
        matchedCommander = matchCommander(fullText);
      }

      if (matchedCommander) {
        const level = extractLevelFromRegion(fullText);
        const skillLevels = extractSkillLevels(fullText);
        
        // Use detected stars, or default based on rarity
        const finalStars = detectedStars > 0 ? detectedStars : 
          (matchedCommander.rarity === 'legendary' ? 5 : 4);
        
        detectedCommanders.push({
          name: matchedCommander.name,
          level,
          stars: finalStars,
          skillLevels,
          confidence: 0.8,
          matchedCommander,
        });
      }

      setProgress(100);

      if (detectedCommanders.length === 0) {
        setError('No commanders detected. Try a clearer screenshot or add commanders manually.');
      } else {
        setDetected(detectedCommanders);
        setSelected(new Set(detectedCommanders.map((_, i) => i)));
      }
    } catch (err) {
      setError('Failed to process image. Please try again.');
      console.error(err);
    } finally {
      setIsProcessing(false);
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
      
      {/* Hidden canvas for image analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20">
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <div>
            <h2 className="text-xl font-semibold text-amber-500">Scan Screenshot</h2>
            <p className="text-xs text-stone-400 mt-1">Beta feature - results may need manual adjustment</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!image ? (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-stone-600 hover:border-amber-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
              <p className="text-stone-300 mb-2">Drop your screenshot here</p>
              <p className="text-stone-500 text-sm mb-4">or click to browse</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleChange}
                className="hidden"
                id="screenshot-upload"
              />
              <label
                htmlFor="screenshot-upload"
                className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold cursor-pointer hover:from-amber-500 hover:to-amber-600 transition-all"
              >
                Select Image
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-stone-900">
                <img src={image} alt="Screenshot" className="w-full h-auto max-h-[200px] object-contain" />
                <button
                  onClick={() => {
                    setImage(null);
                    setDetected([]);
                  }}
                  className="absolute top-2 right-2 p-1 rounded bg-stone-900/80 hover:bg-stone-800"
                >
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              </div>

              {detected.length === 0 && !isProcessing && (
                <button
                  onClick={processImage}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  Scan for Commanders
                </button>
              )}

              {isProcessing && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                  <p className="text-stone-300">Scanning image...</p>
                  <div className="w-48 h-2 bg-stone-700 rounded-full mx-auto mt-3 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-stone-500 text-sm mt-2">{progress}%</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

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
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-stone-700">
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
    </>
  );
}
