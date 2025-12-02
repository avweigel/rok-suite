'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  X,
  Scan,
  Loader2,
  MapPin,
  Gem,
  Wheat,
  CircleDollarSign,
  TreePine,
  Mountain,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRoboflow, type RoboflowPrediction, ROBOFLOW_CLASSES } from '@/hooks/useRoboflow';

interface MapScannerProps {
  onClose: () => void;
}

type ResourceType = 'gem' | 'gold' | 'food' | 'wood' | 'stone' | 'other';

interface DetectedResource {
  type: ResourceType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  occupied: boolean;
}

const RESOURCE_ICONS: Record<ResourceType, typeof Gem> = {
  gem: Gem,
  gold: CircleDollarSign,
  food: Wheat,
  wood: TreePine,
  stone: Mountain,
  other: MapPin,
};

const RESOURCE_COLORS: Record<ResourceType, string> = {
  gem: 'text-purple-400 bg-purple-500/20 border-purple-500/50',
  gold: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
  food: 'text-green-400 bg-green-500/20 border-green-500/50',
  wood: 'text-amber-600 bg-amber-600/20 border-amber-600/50',
  stone: 'text-stone-400 bg-stone-500/20 border-stone-500/50',
  other: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
};

function classifyResource(className: string): { type: ResourceType; occupied: boolean } {
  const lower = className.toLowerCase();

  const occupied = lower.includes('occupied') || lower.includes('ocuppied'); // handle typo in model

  if (lower.includes('gem')) return { type: 'gem', occupied };
  if (lower.includes('gold')) return { type: 'gold', occupied };
  if (lower.includes('corn') || lower.includes('food')) return { type: 'food', occupied };
  if (lower.includes('wood')) return { type: 'wood', occupied };
  if (lower.includes('stone')) return { type: 'stone', occupied };

  return { type: 'other', occupied: false };
}

function predictionToResource(prediction: RoboflowPrediction): DetectedResource {
  const { type, occupied } = classifyResource(prediction.class);

  return {
    type,
    label: ROBOFLOW_CLASSES[prediction.class as keyof typeof ROBOFLOW_CLASSES] || prediction.class,
    x: prediction.x,
    y: prediction.y,
    width: prediction.width,
    height: prediction.height,
    confidence: prediction.confidence,
    occupied,
  };
}

export function MapScanner({ onClose }: MapScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [resources, setResources] = useState<DetectedResource[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [filterType, setFilterType] = useState<ResourceType | 'all'>('all');
  const imageRef = useRef<HTMLImageElement>(null);

  const { detect, isLoading, error, isConfigured, clearError } = useRoboflow({
    minConfidence: 0.3,
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImage(src);
      setResources([]);
      clearError();

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [clearError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleScan = async () => {
    if (!image) return;

    const predictions = await detect(image);

    // Filter for resource nodes only
    const resourcePredictions = predictions.filter(p => {
      const lower = p.class.toLowerCase();
      return (
        lower.includes('node') ||
        lower.includes('gem') ||
        lower.includes('gold') ||
        lower.includes('corn') ||
        lower.includes('wood') ||
        lower.includes('stone')
      );
    });

    setResources(resourcePredictions.map(predictionToResource));
  };

  const filteredResources = filterType === 'all'
    ? resources
    : resources.filter(r => r.type === filterType);

  const resourceCounts = resources.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<ResourceType, number>);

  // Calculate overlay positions relative to displayed image
  const getOverlayPosition = (resource: DetectedResource) => {
    if (!imageRef.current || !imageSize) return null;

    const displayedWidth = imageRef.current.clientWidth;
    const displayedHeight = imageRef.current.clientHeight;

    const scaleX = displayedWidth / imageSize.width;
    const scaleY = displayedHeight / imageSize.height;

    return {
      left: (resource.x - resource.width / 2) * scaleX,
      top: (resource.y - resource.height / 2) * scaleY,
      width: resource.width * scaleX,
      height: resource.height * scaleY,
    };
  };

  if (!isConfigured) {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-amber-500">Screenshot Scanner</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-200 mb-2">Roboflow Configuration Required</h3>
            <p className="text-stone-400 text-sm mb-4">
              To use the Screenshot Scanner, you need to configure Roboflow with your own workspace and model.
            </p>
            <div className="bg-stone-900/50 rounded-lg p-4 text-left space-y-1">
              <p className="text-xs text-stone-500 mb-2">Add to your .env.local file:</p>
              <code className="text-xs text-amber-400 font-mono block">NEXT_PUBLIC_ROBOFLOW_API_KEY=your-api-key</code>
              <code className="text-xs text-amber-400 font-mono block">NEXT_PUBLIC_ROBOFLOW_WORKSPACE=your-workspace</code>
              <code className="text-xs text-amber-400 font-mono block">NEXT_PUBLIC_ROBOFLOW_MODEL=your-model-name</code>
              <code className="text-xs text-amber-400 font-mono block">NEXT_PUBLIC_ROBOFLOW_VERSION=1</code>
            </div>
            <p className="text-stone-500 text-xs mt-4">
              You need to create or fork a model in your own workspace at{' '}
              <a
                href="https://app.roboflow.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-500 hover:underline"
              >
                app.roboflow.com
              </a>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-4xl max-h-[90vh] rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-stone-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-amber-500">Screenshot Scanner</h2>
            <p className="text-xs text-stone-500">Detect game elements using AI vision</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!image ? (
            /* Upload area */
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-stone-600 hover:border-amber-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-amber-500/50 mx-auto mb-3" />
              <p className="text-stone-300 mb-1">Drop a map screenshot here</p>
              <p className="text-stone-500 text-sm mb-4">or click to browse</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleChange}
                className="hidden"
                id="map-upload"
              />
              <label
                htmlFor="map-upload"
                className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold cursor-pointer hover:from-amber-500 hover:to-amber-600 transition-all"
              >
                Select Image
              </label>
            </div>
          ) : (
            /* Image preview with detections */
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowOverlay(!showOverlay)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                      showOverlay
                        ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                        : 'bg-stone-700 text-stone-400 border border-stone-600'
                    }`}
                  >
                    {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    Overlay
                  </button>

                  {resources.length > 0 && (
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as ResourceType | 'all')}
                      className="px-3 py-1.5 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 text-sm"
                    >
                      <option value="all">All Types ({resources.length})</option>
                      {Object.entries(resourceCounts).map(([type, count]) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImage(null);
                      setResources([]);
                      setImageSize(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 text-sm"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={isLoading}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2 text-sm"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4" />
                    )}
                    {isLoading ? 'Scanning...' : 'Scan'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Image with overlay */}
              <div className="relative bg-stone-900 rounded-xl overflow-hidden">
                <img
                  ref={imageRef}
                  src={image}
                  alt="Map screenshot"
                  className="w-full max-h-[500px] object-contain"
                />

                {/* Detection overlays */}
                {showOverlay && filteredResources.map((resource, i) => {
                  const pos = getOverlayPosition(resource);
                  if (!pos) return null;

                  const Icon = RESOURCE_ICONS[resource.type];
                  const colorClass = RESOURCE_COLORS[resource.type];

                  return (
                    <div
                      key={i}
                      className={`absolute border-2 rounded ${colorClass} ${
                        resource.occupied ? 'opacity-50' : ''
                      }`}
                      style={{
                        left: pos.left,
                        top: pos.top,
                        width: pos.width,
                        height: pos.height,
                      }}
                    >
                      <div className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${colorClass}`}>
                        <Icon className="w-3 h-3" />
                        <span>{Math.round(resource.confidence * 100)}%</span>
                        {resource.occupied && <span className="text-red-400">(taken)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Results summary */}
              {resources.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {(['gem', 'gold', 'food', 'wood', 'stone'] as ResourceType[]).map(type => {
                    const count = resourceCounts[type] || 0;
                    const Icon = RESOURCE_ICONS[type];
                    const colorClass = RESOURCE_COLORS[type];
                    const freeCount = resources.filter(r => r.type === type && !r.occupied).length;

                    return (
                      <button
                        key={type}
                        onClick={() => setFilterType(filterType === type ? 'all' : type)}
                        className={`p-3 rounded-lg border transition-all ${
                          filterType === type ? colorClass : 'bg-stone-800 border-stone-700 text-stone-400'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs opacity-70">
                          {freeCount} free
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
