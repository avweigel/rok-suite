// Roboflow Vision API integration for commander detection
// Uses the Rise of Kingdoms object detection model for visual identification

export interface RoboflowPrediction {
  x: number;           // Center X coordinate
  y: number;           // Center Y coordinate
  width: number;       // Bounding box width
  height: number;      // Bounding box height
  confidence: number;  // Detection confidence (0-1)
  class: string;       // Detected class name
  class_id: number;    // Class ID
}

export interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image: {
    width: number;
    height: number;
  };
  time: number;
}

export interface RoboflowConfig {
  apiKey: string;
  workspace: string;   // Roboflow workspace/username
  modelId: string;
  modelVersion: string;
}

// Default configuration - requires user to set their own workspace
// The rise-of-kingdom model exists but requires access through a workspace
const DEFAULT_CONFIG: Omit<RoboflowConfig, 'apiKey'> = {
  workspace: process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE || '',
  modelId: process.env.NEXT_PUBLIC_ROBOFLOW_MODEL || 'rise-of-kingdom',
  modelVersion: process.env.NEXT_PUBLIC_ROBOFLOW_VERSION || '1',
};

/**
 * Detect objects in an image using Roboflow's hosted inference API
 *
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @param config - Optional configuration overrides
 * @returns Roboflow detection response
 */
export async function detectWithRoboflow(
  imageBase64: string,
  config?: Partial<RoboflowConfig>
): Promise<RoboflowResponse> {
  const apiKey = config?.apiKey || process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;

  if (!apiKey) {
    throw new Error('Roboflow API key not configured. Set NEXT_PUBLIC_ROBOFLOW_API_KEY in .env.local');
  }

  const workspace = config?.workspace || DEFAULT_CONFIG.workspace;
  const modelId = config?.modelId || DEFAULT_CONFIG.modelId;
  const modelVersion = config?.modelVersion || DEFAULT_CONFIG.modelVersion;

  if (!workspace) {
    throw new Error('Roboflow workspace not configured. Set NEXT_PUBLIC_ROBOFLOW_WORKSPACE in .env.local');
  }

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // URL format: https://detect.roboflow.com/{workspace}/{model}/{version}
  const url = `https://detect.roboflow.com/${workspace}/${modelId}/${modelVersion}?api_key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: base64Data,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Roboflow API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Check if Roboflow is configured and available
 */
export function isRoboflowConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY &&
    process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE
  );
}

/**
 * Classes that the Rise of Kingdoms model can detect
 * Based on the model's training data
 */
export const ROBOFLOW_CLASSES = {
  // UI Elements
  'city-btn': 'City Button',
  'find-btn': 'Find Button',
  'play': 'Play Button',
  'player': 'Player',

  // Game Objects
  'wolf': 'Wolf (Barbarian)',
  'tree': 'Resource Tree',
  'stone': 'Stone Deposit',
  'gem-z-out': 'Gem (Zoomed Out)',
  'objects': 'Game Objects',
  'Village': 'Village',

  // Resource Nodes
  'Free-Corn-Node': 'Free Corn Node',
  'Free-Gem-Node': 'Free Gem Node',
  'Free-Gold-Node': 'Free Gold Node',
  'Free-Stone-Node': 'Free Stone Node',
  'Free-Wood-Node': 'Free Wood Node',
  'Ocuppied-Corn-Node': 'Occupied Corn Node',
  'Occupied-Gem-Node-Zoom-out': 'Occupied Gem Node (Zoomed Out)',
  'Occupied-Gold-Node-Zoom-out': 'Occupied Gold Node (Zoomed Out)',
  'Occupied-Stone-Node': 'Occupied Stone Node',
  'Occupied-Wood-Node': 'Occupied Wood Node',
} as const;

export type RoboflowClass = keyof typeof ROBOFLOW_CLASSES;

/**
 * Filter predictions by class
 */
export function filterByClass(
  predictions: RoboflowPrediction[],
  classes: RoboflowClass[]
): RoboflowPrediction[] {
  return predictions.filter(p => classes.includes(p.class as RoboflowClass));
}

/**
 * Filter predictions by minimum confidence
 */
export function filterByConfidence(
  predictions: RoboflowPrediction[],
  minConfidence: number
): RoboflowPrediction[] {
  return predictions.filter(p => p.confidence >= minConfidence);
}

/**
 * Get the highest confidence prediction for a given class
 */
export function getBestPrediction(
  predictions: RoboflowPrediction[],
  className?: RoboflowClass
): RoboflowPrediction | null {
  const filtered = className
    ? predictions.filter(p => p.class === className)
    : predictions;

  if (filtered.length === 0) return null;

  return filtered.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

/**
 * Extract bounding box coordinates for cropping
 */
export function getBoundingBox(prediction: RoboflowPrediction): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: prediction.x - prediction.width / 2,
    top: prediction.y - prediction.height / 2,
    right: prediction.x + prediction.width / 2,
    bottom: prediction.y + prediction.height / 2,
  };
}
