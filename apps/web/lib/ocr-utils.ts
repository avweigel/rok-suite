/**
 * OCR utilities for image preprocessing
 * Improves text recognition accuracy for Rise of Kingdoms screenshots
 */

/**
 * Preprocess image for better OCR results
 * - Converts to grayscale
 * - Increases contrast
 * - Applies adaptive thresholding
 */
export async function preprocessImageForOCR(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Use original size for better quality
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale using luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Increase contrast (1.5x)
        const contrast = 1.5;
        const factor = (259 * (contrast * 128 + 255)) / (255 * (259 - contrast * 128));
        let newGray = factor * (gray - 128) + 128;

        // Clamp values
        newGray = Math.max(0, Math.min(255, newGray));

        // Apply adaptive threshold for text (make it more black/white)
        // This helps with RoK's stylized fonts
        const threshold = 140;
        const finalValue = newGray < threshold ? 0 : 255;

        data[i] = finalValue;     // R
        data[i + 1] = finalValue; // G
        data[i + 2] = finalValue; // B
        // Alpha stays the same
      }

      ctx.putImageData(imageData, 0, 0);

      // Return processed image as data URL
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * Process image with OCR using Tesseract
 * Includes preprocessing and optimized settings for game text
 */
export async function processImageWithOCR(imageSrc: string): Promise<string> {
  // Preprocess image for better OCR
  const processedImage = await preprocessImageForOCR(imageSrc);

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  // Configure Tesseract for better results with game text
  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/★.,:%+- ',
    preserve_interword_spaces: '1',
  });

  const { data: { text } } = await worker.recognize(processedImage);
  await worker.terminate();

  return text;
}
