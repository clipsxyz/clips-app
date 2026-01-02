/**
 * Instagram-style image dimension calculation
 * Works for both web and React Native
 */

// Instagram aspect ratio limits
const MIN_ASPECT = 1 / 1.91; // Landscape minimum (≈0.523)
const MAX_ASPECT = 4 / 5; // Portrait maximum (1.25)

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Get screen width - works for both web and React Native
 */
export const getScreenWidth = (): number => {
  // Web
  if (typeof window !== 'undefined') {
    return window.innerWidth;
  }
  // React Native - will be passed as parameter
  throw new Error('Screen width must be provided for React Native');
};

/**
 * Calculate Instagram-style image dimensions with aspect ratio clamping
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param screenWidth - Screen width (required for React Native, optional for web)
 * @returns Calculated dimensions with clamped aspect ratio
 */
export const getInstagramImageDimensions = (
  originalWidth: number,
  originalHeight: number,
  screenWidth?: number
): ImageDimensions => {
  const width = screenWidth ?? getScreenWidth();
  
  // Calculate original aspect ratio
  const aspectRatio = originalHeight / originalWidth;
  
  // Clamp to Instagram limits
  const clampedAspect = Math.min(Math.max(aspectRatio, MIN_ASPECT), MAX_ASPECT);
  
  return {
    width,
    height: width * clampedAspect,
    aspectRatio: clampedAspect
  };
};

/**
 * Auto-detect image dimensions from URL (web only)
 * @param uri - Image URL
 * @returns Promise with width and height
 */
export const getImageSize = (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    // Web implementation
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = reject;
      img.src = uri;
      return;
    }
    
    // React Native implementation - use Image.getSize
    // This will be handled in the component
    reject(new Error('Image size detection must be handled in component for React Native'));
  });
};

/**
 * Check if aspect ratio needs clamping
 */
export const needsClamping = (aspectRatio: number): boolean => {
  return aspectRatio < MIN_ASPECT || aspectRatio > MAX_ASPECT;
};







