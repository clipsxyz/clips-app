import React, { useState, useEffect, useRef } from 'react';

interface ProgressiveImageProps {
    src: string;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    onLoad?: (e?: React.SyntheticEvent<HTMLImageElement>) => void;
    onError?: () => void;
    priority?: boolean; // If true, load immediately (for first 1-3 images)
    blurDataURL?: string; // Base64 encoded low-res placeholder
}

/**
 * Instagram-style progressive image loading:
 * 1. Shows blur placeholder immediately (30ms)
 * 2. Loads low-res version
 * 3. Loads full resolution
 */
export default function ProgressiveImage({
    src,
    alt = '',
    className = '',
    style,
    onLoad,
    onError,
    priority = false,
    blurDataURL
}: ProgressiveImageProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [lowResSrc, setLowResSrc] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate low-res placeholder if not provided
    const generateBlurPlaceholder = (): string => {
        if (blurDataURL) return blurDataURL;

        // Create a tiny 20x20 canvas with average color from URL hash
        const canvas = document.createElement('canvas');
        canvas.width = 20;
        canvas.height = 20;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Generate a subtle gradient based on image URL hash
            const hash = src.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const hue = hash % 360;
            const gradient = ctx.createLinearGradient(0, 0, 20, 20);
            gradient.addColorStop(0, `hsl(${hue}, 30%, 20%)`);
            gradient.addColorStop(1, `hsl(${hue}, 30%, 15%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 20, 20);
        }
        return canvas.toDataURL('image/jpeg', 0.1);
    };

    const [blurPlaceholder] = useState(() => generateBlurPlaceholder());

    // Generate low-res URL (if backend supports it, otherwise use full URL with size param)
    const getLowResUrl = (url: string): string => {
        // Check if URL is a data URL or external URL
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url; // Can't optimize data/blob URLs
        }

        // Try to use WebP format if supported
        const supportsWebP = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
        const format = supportsWebP ? 'webp' : 'jpg';

        // If URL already has query params, append; otherwise add
        const separator = url.includes('?') ? '&' : '?';
        // Request smaller version (20% size for low-res, WebP if supported)
        return `${url}${separator}w=400&q=30&format=${format}`;
    };

    // Get full resolution URL with WebP support
    const getFullResUrl = (url: string): string => {
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }

        const supportsWebP = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
        if (supportsWebP && !url.includes('format=')) {
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}format=webp`;
        }
        return url;
    };

    // Load strategy: priority images load immediately, others wait for intersection
    useEffect(() => {
        if (priority) {
            // Priority images (first 1-3): load immediately
            setLowResSrc(getLowResUrl(src));
            setImageSrc(getFullResUrl(src));
        } else {
            // Non-priority: use Intersection Observer for lazy loading
            if (!containerRef.current) return;

            observerRef.current = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            // Start loading when visible
                            setLowResSrc(getLowResUrl(src));
                            // Load full res after a small delay
                            setTimeout(() => {
                                setImageSrc(getFullResUrl(src));
                            }, 100);
                            // Disconnect after starting load
                            if (observerRef.current) {
                                observerRef.current.disconnect();
                            }
                        }
                    });
                },
                {
                    rootMargin: '200px', // Start loading 200px before entering viewport
                    threshold: 0.01
                }
            );

            observerRef.current.observe(containerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [src, priority]);

    const handleLowResLoad = () => {
        // Low-res loaded, now load full resolution
        if (!imageSrc) {
            setImageSrc(getFullResUrl(src));
        }
    };

    const handleFullResLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        onLoad?.(e);
    };

    const handleError = () => {
        setHasError(true);
        onError?.();
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden ${className}`}
            style={style}
        >
            {/* Blur placeholder - shows immediately */}
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundImage: `url(${blurPlaceholder})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px)',
                    transform: 'scale(1.1)', // Slight scale to prevent blur edges
                    opacity: isLoaded ? 0 : 1,
                    transition: 'opacity 0.3s ease-out'
                }}
            />

            {/* Low-res image - loads first */}
            {lowResSrc && (
                <img
                    src={lowResSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                        opacity: isLoaded ? 0 : 1,
                        transition: 'opacity 0.3s ease-out'
                    }}
                    onLoad={handleLowResLoad}
                    loading="lazy"
                    decoding="async"
                />
            )}

            {/* Full resolution image */}
            {imageSrc && (
                <img
                    ref={imgRef}
                    src={imageSrc}
                    alt={alt}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-out'
                    }}
                    onLoad={handleFullResLoad}
                    onError={handleError}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                />
            )}

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                    <div className="text-center text-white">
                        <div className="text-2xl mb-2">⚠️</div>
                        <div className="text-sm">Failed to load image</div>
                    </div>
                </div>
            )}
        </div>
    );
}

