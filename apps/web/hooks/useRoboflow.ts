'use client';

import { useState, useCallback } from 'react';
import {
  detectWithRoboflow,
  isRoboflowConfigured,
  filterByConfidence,
  filterByClass,
  getBestPrediction,
  type RoboflowResponse,
  type RoboflowPrediction,
  type RoboflowClass,
} from '@/lib/sunset-canyon/roboflow';

export interface UseRoboflowOptions {
  minConfidence?: number;
  filterClasses?: RoboflowClass[];
}

export interface UseRoboflowReturn {
  detect: (imageBase64: string) => Promise<RoboflowPrediction[]>;
  isLoading: boolean;
  error: string | null;
  lastResponse: RoboflowResponse | null;
  isConfigured: boolean;
  clearError: () => void;
}

/**
 * React hook for using Roboflow vision detection
 *
 * @example
 * ```tsx
 * const { detect, isLoading, error, isConfigured } = useRoboflow({
 *   minConfidence: 0.5,
 *   filterClasses: ['Free-Gem-Node', 'Free-Gold-Node'],
 * });
 *
 * const handleScan = async (imageBase64: string) => {
 *   const predictions = await detect(imageBase64);
 *   console.log('Found:', predictions);
 * };
 * ```
 */
export function useRoboflow(options: UseRoboflowOptions = {}): UseRoboflowReturn {
  const { minConfidence = 0.3, filterClasses } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<RoboflowResponse | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const detect = useCallback(
    async (imageBase64: string): Promise<RoboflowPrediction[]> => {
      if (!isRoboflowConfigured()) {
        setError('Roboflow API key not configured');
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await detectWithRoboflow(imageBase64);
        setLastResponse(response);

        let predictions = response.predictions;

        // Apply confidence filter
        predictions = filterByConfidence(predictions, minConfidence);

        // Apply class filter if specified
        if (filterClasses && filterClasses.length > 0) {
          predictions = filterByClass(predictions, filterClasses);
        }

        return predictions;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Detection failed';
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [minConfidence, filterClasses]
  );

  return {
    detect,
    isLoading,
    error,
    lastResponse,
    isConfigured: isRoboflowConfigured(),
    clearError,
  };
}

// Re-export utilities for convenience
export {
  filterByConfidence,
  filterByClass,
  getBestPrediction,
  isRoboflowConfigured,
  ROBOFLOW_CLASSES,
} from '@/lib/sunset-canyon/roboflow';

export type { RoboflowPrediction, RoboflowResponse, RoboflowClass } from '@/lib/sunset-canyon/roboflow';
