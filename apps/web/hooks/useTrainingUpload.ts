'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  uploadToRoboflow,
  isRoboflowUploadConfigured,
  type TrainingAnnotation,
} from '@/lib/sunset-canyon/roboflow-upload';

export interface TrainingSample {
  imageBase64: string;
  commanderName: string;
  originalOcrText?: string;
  wasCorrected: boolean;
  imageWidth?: number;
  imageHeight?: number;
}

export interface UseTrainingUploadReturn {
  submitSample: (sample: TrainingSample) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
  isConfigured: boolean;
  successCount: number;
  clearError: () => void;
}

/**
 * React hook for submitting training samples to Roboflow
 *
 * @example
 * ```tsx
 * const { submitSample, isUploading, error, successCount } = useTrainingUpload();
 *
 * const handleAccept = async (imageBase64: string, commanderName: string) => {
 *   const success = await submitSample({
 *     imageBase64,
 *     commanderName,
 *     originalOcrText: ocrResult,
 *     wasCorrected: ocrResult !== commanderName,
 *   });
 *   if (success) {
 *     console.log('Sample submitted for training!');
 *   }
 * };
 * ```
 */
export function useTrainingUpload(): UseTrainingUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const submitSample = useCallback(async (sample: TrainingSample): Promise<boolean> => {
    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get current user (optional - samples can be anonymous)
      const { data: { user } } = await supabase.auth.getUser();

      // Create training annotation
      const annotation: TrainingAnnotation = {
        commanderName: sample.commanderName,
        // For now, we're uploading full screenshots
        // Later we can add bounding box detection
      };

      let roboflowImageId: string | undefined;
      let uploadStatus: 'pending' | 'uploaded' | 'failed' = 'pending';
      let errorMessage: string | undefined;

      // Try to upload to Roboflow if configured
      if (isRoboflowUploadConfigured()) {
        const result = await uploadToRoboflow(sample.imageBase64, annotation);

        if (result.success) {
          roboflowImageId = result.imageId;
          uploadStatus = 'uploaded';
        } else {
          uploadStatus = 'failed';
          errorMessage = result.error;
          // Don't fail the whole operation - we can still log metadata
          console.warn('Roboflow upload failed:', result.error);
        }
      } else {
        // Roboflow not configured - just log metadata for now
        uploadStatus = 'pending';
      }

      // Save metadata to Supabase
      const { error: dbError } = await supabase
        .from('training_samples')
        .insert({
          user_id: user?.id || null,
          roboflow_image_id: roboflowImageId,
          commander_name: sample.commanderName,
          original_ocr_text: sample.originalOcrText,
          was_corrected: sample.wasCorrected,
          image_width: sample.imageWidth,
          image_height: sample.imageHeight,
          upload_status: uploadStatus,
          error_message: errorMessage,
        });

      if (dbError) {
        // Log error but don't fail - the Roboflow upload may have succeeded
        console.warn('Failed to save training metadata:', dbError);
      }

      // Consider success if either Roboflow upload or DB insert worked
      if (uploadStatus === 'uploaded' || !dbError) {
        setSuccessCount(prev => prev + 1);
        return true;
      }

      setError('Failed to submit training sample');
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    submitSample,
    isUploading,
    error,
    isConfigured: isRoboflowUploadConfigured(),
    successCount,
    clearError,
  };
}
