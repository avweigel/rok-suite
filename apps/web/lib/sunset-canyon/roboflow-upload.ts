// Roboflow Upload API for training data collection
// Uploads images directly to Roboflow for model training

export interface RoboflowUploadConfig {
  apiKey: string;
  workspace: string;
  project: string;
}

export interface AnnotationBox {
  x: number;      // Center X (0-1 normalized)
  y: number;      // Center Y (0-1 normalized)
  width: number;  // Width (0-1 normalized)
  height: number; // Height (0-1 normalized)
  class: string;  // Class label
}

export interface TrainingAnnotation {
  commanderName: string;
  boxes?: AnnotationBox[];  // Optional bounding boxes for detected regions
}

export interface UploadResult {
  success: boolean;
  imageId?: string;
  error?: string;
}

// Image validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 4096;

/**
 * Validate an image before upload
 */
export async function validateImage(
  base64OrBlob: string | Blob
): Promise<{ valid: boolean; error?: string; blob?: Blob }> {
  try {
    let blob: Blob;

    if (typeof base64OrBlob === 'string') {
      // Convert base64 to blob
      const response = await fetch(base64OrBlob);
      blob = await response.blob();
    } else {
      blob = base64OrBlob;
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(blob.type)) {
      return {
        valid: false,
        error: `Invalid file type: ${blob.type}. Allowed: JPEG, PNG, WebP`,
      };
    }

    // Check file size
    if (blob.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large: ${(blob.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`,
      };
    }

    // Check dimensions
    const dimensions = await getImageDimensions(blob);
    if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
      return {
        valid: false,
        error: `Image too large: ${dimensions.width}x${dimensions.height}. Max: ${MAX_DIMENSION}px`,
      };
    }

    return { valid: true, blob };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}

/**
 * Get image dimensions from a blob
 */
function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Compress an image to reduce file size
 * Returns the original if compression would increase size
 */
export async function compressImage(
  base64: string,
  quality: number = 0.8,
  maxDimension: number = 1920
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with compression
      const compressed = canvas.toDataURL('image/jpeg', quality);

      // Return smaller of the two
      resolve(compressed.length < base64.length ? compressed : base64);
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * Upload an image to Roboflow for training
 *
 * @param imageBase64 - Base64 encoded image
 * @param annotation - Training annotation with commander name and optional boxes
 * @param config - Roboflow configuration (uses env vars if not provided)
 */
export async function uploadToRoboflow(
  imageBase64: string,
  annotation: TrainingAnnotation,
  config?: Partial<RoboflowUploadConfig>
): Promise<UploadResult> {
  const apiKey = config?.apiKey || process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
  const workspace = config?.workspace || process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE;
  const project = config?.project || process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT || 'commander-detection';

  if (!apiKey) {
    return { success: false, error: 'Roboflow API key not configured' };
  }

  if (!workspace) {
    return { success: false, error: 'Roboflow workspace not configured' };
  }

  // Validate image
  const validation = await validateImage(imageBase64);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Compress if needed
  const compressed = await compressImage(imageBase64);

  // Strip data URL prefix
  const base64Data = compressed.replace(/^data:image\/\w+;base64,/, '');

  // Build the upload URL
  // Roboflow Upload API: https://docs.roboflow.com/api-reference/images/upload-image
  const uploadUrl = `https://api.roboflow.com/dataset/${workspace}/${project}/upload?api_key=${apiKey}&name=${encodeURIComponent(annotation.commanderName)}_${Date.now()}.jpg&split=train`;

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: base64Data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Upload failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    // If we have annotation boxes, add them
    if (annotation.boxes && annotation.boxes.length > 0 && result.id) {
      await addAnnotations(result.id, annotation, { apiKey, workspace, project });
    }

    return {
      success: true,
      imageId: result.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

/**
 * Add annotations to an uploaded image
 */
async function addAnnotations(
  imageId: string,
  annotation: TrainingAnnotation,
  config: RoboflowUploadConfig
): Promise<void> {
  const { apiKey, project } = config;

  // Roboflow annotation format
  const annotationData = {
    name: `${annotation.commanderName}.jpg`,
    annotation: annotation.boxes?.map(box => ({
      label: box.class,
      coordinates: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    })) || [],
  };

  const annotateUrl = `https://api.roboflow.com/dataset/${workspace}/${project}/annotate/${imageId}?api_key=${apiKey}`;

  await fetch(annotateUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotationData),
  });
}

/**
 * Check if Roboflow upload is configured
 */
export function isRoboflowUploadConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY &&
    process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE
  );
}
