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
  workflowId: string;  // Workflow ID for serverless API
}

/**
 * Detect objects in an image using Roboflow's Serverless Workflow API
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
  const workspace = config?.workspace || process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE || '';
  const workflowId = config?.workflowId || process.env.NEXT_PUBLIC_ROBOFLOW_WORKFLOW || '';

  if (!apiKey) {
    throw new Error('Roboflow API key not configured. Set NEXT_PUBLIC_ROBOFLOW_API_KEY in .env.local');
  }

  if (!workspace) {
    throw new Error('Roboflow workspace not configured. Set NEXT_PUBLIC_ROBOFLOW_WORKSPACE in .env.local');
  }

  if (!workflowId) {
    throw new Error('Roboflow workflow not configured. Set NEXT_PUBLIC_ROBOFLOW_WORKFLOW in .env.local');
  }

  // Workflow API URL format
  const url = `https://serverless.roboflow.com/${workspace}/workflows/${workflowId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      inputs: {
        image: { type: 'base64', value: imageBase64 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Roboflow API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Transform workflow response to match our expected format
  // The workflow response structure may vary - adjust as needed
  return transformWorkflowResponse(result);
}

/**
 * Transform Roboflow workflow response to our standard format
 */
function transformWorkflowResponse(result: Record<string, unknown>): RoboflowResponse {
  // Workflow responses contain outputs from each step
  // We need to extract predictions from the detection step
  const outputs = result.outputs as Record<string, unknown>[] | undefined;

  if (!outputs || outputs.length === 0) {
    return { predictions: [], image: { width: 0, height: 0 }, time: 0 };
  }

  // Find predictions in outputs - structure depends on workflow configuration
  let predictions: RoboflowPrediction[] = [];

  for (const output of outputs) {
    // Check for predictions array in various possible locations
    if (Array.isArray(output.predictions)) {
      predictions = output.predictions as RoboflowPrediction[];
      break;
    }
    // Some workflows nest predictions differently
    if (output.result && Array.isArray((output.result as Record<string, unknown>).predictions)) {
      predictions = (output.result as Record<string, unknown>).predictions as RoboflowPrediction[];
      break;
    }
  }

  return {
    predictions,
    image: { width: 0, height: 0 },
    time: 0,
  };
}

/**
 * Check if Roboflow is configured and available
 */
export function isRoboflowConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY &&
    process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE &&
    process.env.NEXT_PUBLIC_ROBOFLOW_WORKFLOW
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
