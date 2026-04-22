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

/**
 * Convert an image source URL to a data URL constrained to Instagram feed bounds.
 * - Keeps image unchanged when already within range.
 * - Center-crops only when outside the supported ratio window.
 */
export const constrainImageToInstagramDataUrl = async (
  src: string,
  quality = 0.92,
): Promise<string> => {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return src;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });

  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;
  if (!sourceW || !sourceH) return src;

  const aspect = sourceH / sourceW; // height / width
  let cropW = sourceW;
  let cropH = sourceH;
  let offsetX = 0;
  let offsetY = 0;

  if (aspect > MAX_ASPECT) {
    // Too tall -> crop top/bottom to 4:5.
    cropH = Math.round(sourceW * MAX_ASPECT);
    offsetY = Math.max(0, Math.floor((sourceH - cropH) / 2));
  } else if (aspect < MIN_ASPECT) {
    // Too wide -> crop left/right to 1.91:1.
    cropW = Math.round(sourceH / MIN_ASPECT);
    offsetX = Math.max(0, Math.floor((sourceW - cropW) / 2));
  }

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas.toDataURL('image/jpeg', quality);
};









