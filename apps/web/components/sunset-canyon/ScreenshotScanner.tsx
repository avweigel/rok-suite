'use client';

import { useState, useCallback, useEffect } from 'react';
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
    // Normalize text: lowercase, remove extra spaces, handle common OCR issues
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')  // Replace special chars with spaces
      .replace(/\s+/g, ' ')           // Collapse multiple spaces
      .trim();
    
    for (const commander of commanders) {
      const commanderName = commander.name.toLowerCase();
      
      // Direct match
      if (normalizedText.includes(commanderName)) {
        return commander;
      }
      
      // Match individual name parts (for names like "Cao Cao", "Yi Seong-Gye")
      const nameParts = commanderName.split(/[\s-]+/);
      for (const part of nameParts) {
        if (part.length >= 3 && normalizedText.includes(part)) {
          return commander;
        }
      }
      
      // Handle common OCR variations
      const variations = [
        commanderName.replace(/\s+/g, ''),  // "caocao"
        commanderName.replace(/-/g, ' '),    // "yi seong gye"
      ];
      
      for (const variation of variations) {
        if (normalizedText.includes(variation)) {
          return commander;
        }
      }
    }
    return null;
  };

  const extractLevel = (text: string): number => {
    const levelMatch = text.match(/(?:level|lv\.?|lvl\.?)\s*(\d{1,2})/i);
    if (levelMatch) return parseInt(levelMatch[1]);
    const standaloneNumbers = text.match(/\b([1-5]?\d)\b/g);
    if (standaloneNumbers) {
      for (const num of standaloneNumbers) {
        const n = parseInt(num);
        if (n >= 1 && n <= 60) return n;
      }
    }
    return 1;
  };

  const extractStars = (text: string): number => {
    const starPatterns = [
      /(\d)\s*(?:star|★|⭐)/i,
      /(?:star|★|⭐)\s*(\d)/i,
    ];
    for (const pattern of starPatterns) {
      const match = text.match(pattern);
      if (match) {
        const stars = parseInt(match[1]);
        if (stars >= 1 && stars <= 5) return stars;
      }
    }
    return 1;
  };

  const extractSkills = (text: string): number[] => {
    const skillPattern = /(\d)[\/\s,]+(\d)[\/\s,]+(\d)[\/\s,]+(\d)/;
    const match = text.match(skillPattern);
    if (match) {
      return [
        Math.min(5, Math.max(1, parseInt(match[1]))),
        Math.min(5, Math.max(1, parseInt(match[2]))),
        Math.min(5, Math.max(1, parseInt(match[3]))),
        Math.min(5, Math.max(1, parseInt(match[4]))),
      ];
    }
    return [1, 1, 1, 1];
  };

  const processImage = async () => {
    if (!image) return;
    
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();

      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const detectedCommanders: DetectedCommander[] = [];
      
      for (const line of lines) {
        const matched = matchCommander(line);
        if (matched) {
          const alreadyDetected = detectedCommanders.some(d => d.matchedCommander?.id === matched.id);
          if (!alreadyDetected) {
            detectedCommanders.push({
              name: matched.name,
              level: extractLevel(text),
              stars: extractStars(text),
              skillLevels: extractSkills(text),
              confidence: 0.7,
              matchedCommander: matched,
            });
          }
        }
      }

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
