import React, { useState, useEffect, useRef } from 'react';

interface ProgressiveImageProps {
    src: string;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    fit?: 'cover' | 'contain';
    position?: string;
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
    fit = 'cover',
    position = 'center',
    onLoad,
    onError,
    priority = false,
    blurDataURL
}: ProgressiveImageProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
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

    // One request for the real file. Extra w=/format= copies were the full
    // photo again, and they queued behind the clips further down the feed.
    useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
        if (!src) {
            setImageSrc(null);
            return;
        }
        if (priority) {
            setImageSrc(src);
            return;
        }
        if (!containerRef.current) return;
        const scrollRoot = containerRef.current.closest('.overflow-y-auto');
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                setImageSrc(src);
                observerRef.current?.disconnect();
            },
            {
                root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
                rootMargin: '600px 0px',
                threshold: 0,
            },
        );
        observerRef.current.observe(containerRef.current);
        return () => {
            observerRef.current?.disconnect();
        };
    }, [src, priority]);

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

            {/* Full resolution image */}
            {imageSrc && (
                <img
                    ref={imgRef}
                    src={imageSrc}
                    alt={alt}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                        objectFit: fit,
                        objectPosition: position,
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-out'
                    }}
                    onLoad={handleFullResLoad}
                    onError={handleError}
                    loading="eager"
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

