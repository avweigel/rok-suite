// Roboflow Object Detection API for commander screenshot scanning
// Uses the trained model to detect commander UI elements directly

export interface DetectionPrediction {
  x: number;           // Center X coordinate
  y: number;           // Center Y coordinate
  width: number;       // Bounding box width
  height: number;      // Bounding box height
  confidence: number;  // Detection confidence (0-1)
  class: string;       // Detected class name
  class_id: number;    // Class ID
}

export interface DetectionResponse {
  predictions: DetectionPrediction[];
  image: {
    width: number;
    height: number;
  };
  time: number;
}

// Classes the model can detect
export type DetectionClass =
  | 'commander-portrait'
  | 'commander-name'
  | 'star'
  | 'skill-icon'
  | 'level-badge';

export interface CommanderDetection {
  portrait?: DetectionPrediction;
  nameRegion?: DetectionPrediction;
  stars: DetectionPrediction[];
  skills: DetectionPrediction[];
  levelBadge?: DetectionPrediction;
  starCount: number;
  skillCount: number;
  confidence: number;
}

/**
 * Detect commander UI elements in a screenshot using Roboflow
 *
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @returns Detection response with predictions
 */
export async function detectCommander(
  imageBase64: string
): Promise<DetectionResponse> {
  const apiKey = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
  const project = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT || 'rok-commander-scanner-rbbb5';
  const version = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_VERSION || '1';

  if (!apiKey) {
    throw new Error('Roboflow API key not configured. Set NEXT_PUBLIC_ROBOFLOW_API_KEY');
  }

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Use Roboflow's hosted inference API
  // https://docs.roboflow.com/deploy/hosted-api/object-detection
  const url = `https://detect.roboflow.com/${project}/${version}?api_key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: base64Data,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Roboflow detection failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Parse detection results into structured commander data
 */
export function parseDetections(response: DetectionResponse): CommanderDetection {
  const predictions = response.predictions;

  // Group predictions by class
  const portrait = predictions.find(p => p.class === 'commander-portrait');
  const nameRegion = predictions.find(p => p.class === 'commander-name');
  const stars = predictions.filter(p => p.class === 'star');
  const skills = predictions.filter(p => p.class === 'skill-icon');
  const levelBadge = predictions.find(p => p.class === 'level-badge');

  // Calculate overall confidence
  const allConfidences = predictions.map(p => p.confidence);
  const avgConfidence = allConfidences.length > 0
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    : 0;

  return {
    portrait,
    nameRegion,
    stars,
    skills,
    levelBadge,
    starCount: stars.length,
    skillCount: skills.length,
    confidence: avgConfidence,
  };
}

/**
 * Crop a region from an image based on detection coordinates
 * Returns a base64 image of the cropped region
 */
export async function cropRegion(
  imageBase64: string,
  prediction: DetectionPrediction
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Convert center coordinates to top-left
      const left = Math.max(0, prediction.x - prediction.width / 2);
      const top = Math.max(0, prediction.y - prediction.height / 2);
      const width = Math.min(prediction.width, img.width - left);
      const height = Math.min(prediction.height, img.height - top);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(
        img,
        left, top, width, height,  // Source
        0, 0, width, height        // Destination
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageBase64;
  });
}

/**
 * Extract commander name from the name region using lightweight OCR
 * Falls back to Tesseract for the small cropped region
 */
export async function extractNameFromRegion(
  imageBase64: string,
  nameRegion: DetectionPrediction
): Promise<string> {
  // Crop the name region for targeted OCR
  const croppedImage = await cropRegion(imageBase64, nameRegion);

  // Use Tesseract only on the small name region (much faster than full image)
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const { data: { text } } = await worker.recognize(croppedImage);
    await worker.terminate();

    // Clean up the text
    return text
      .trim()
      .replace(/\n/g, ' ')
      .replace(/[^a-zA-Z\s'-]/g, '')
      .trim();
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

/**
 * Check if Roboflow detection is configured
 */
export function isDetectionConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY);
}

/**
 * Full pipeline: detect and extract commander info from screenshot
 */
export interface ExtractedCommander {
  detectedName: string;
  starCount: number;
  skillCount: number;
  confidence: number;
  detection: CommanderDetection;
  imageWidth: number;
  imageHeight: number;
}

export async function extractCommanderFromScreenshot(
  imageBase64: string
): Promise<ExtractedCommander | null> {
  try {
    // Step 1: Detect UI elements with Roboflow
    const detectionResponse = await detectCommander(imageBase64);

    if (detectionResponse.predictions.length === 0) {
      return null;
    }

    // Step 2: Parse detections
    const detection = parseDetections(detectionResponse);

    // Step 3: Extract name from detected region (or empty if no region found)
    let detectedName = '';
    if (detection.nameRegion) {
      try {
        detectedName = await extractNameFromRegion(imageBase64, detection.nameRegion);
      } catch (err) {
        console.warn('Failed to extract name from region:', err);
      }
    }

    return {
      detectedName,
      starCount: detection.starCount,
      skillCount: detection.skillCount,
      confidence: detection.confidence,
      detection,
      imageWidth: detectionResponse.image.width,
      imageHeight: detectionResponse.image.height,
    };
  } catch (error) {
    console.error('Commander extraction failed:', error);
    return null;
  }
}
