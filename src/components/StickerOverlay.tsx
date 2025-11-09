import React from 'react';
import { FiX, FiRotateCw, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import type { StickerOverlay, Sticker } from '../types';

interface StickerOverlayProps {
    overlay: StickerOverlay;
    onUpdate: (overlay: StickerOverlay) => void;
    onRemove: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerWidth: number;
    containerHeight: number;
}

export default function StickerOverlayComponent({
    overlay,
    onUpdate,
    onRemove,
    isSelected,
    onSelect,
    containerWidth,
    containerHeight
}: StickerOverlayProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [isResizing, setIsResizing] = React.useState(false);
    const [isRotating, setIsRotating] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const [initialState, setInitialState] = React.useState<StickerOverlay | null>(null);

    const stickerRef = React.useRef<HTMLDivElement>(null);

    // Calculate pixel positions from percentages
    const pixelX = (overlay.x / 100) * containerWidth;
    const pixelY = (overlay.y / 100) * containerHeight;

    const isReadOnly = onUpdate.toString().includes('() => {}') || onRemove.toString().includes('() => {}');

    function handleMouseDown(e: React.MouseEvent) {
        e.stopPropagation();
        // Only allow interaction if not read-only
        if (isReadOnly) {
            return; // Read-only mode
        }
        onSelect();

        if (e.target === stickerRef.current || (e.target as HTMLElement).closest('.sticker-content')) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pixelX, y: e.clientY - pixelY });
            setInitialState({ ...overlay });
        }
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (isDragging && initialState) {
            const newX = ((e.clientX - dragStart.x) / containerWidth) * 100;
            const newY = ((e.clientY - dragStart.y) / containerHeight) * 100;

            onUpdate({
                ...overlay,
                x: Math.max(0, Math.min(100, newX)),
                y: Math.max(0, Math.min(100, newY))
            });
        } else if (isResizing && initialState) {
            const rect = stickerRef.current?.getBoundingClientRect();
            if (rect) {
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distance = Math.sqrt(
                    Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
                );
                const baseSize = overlay.sticker.category === 'GIF' ? 80 : 50; // Base size in pixels (larger for GIFs)
                const newScale = Math.max(0.5, Math.min(2.0, distance / baseSize));

                onUpdate({
                    ...overlay,
                    scale: newScale
                });
            }
        } else if (isRotating && initialState) {
            const rect = stickerRef.current?.getBoundingClientRect();
            if (rect) {
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

                onUpdate({
                    ...overlay,
                    rotation: angle
                });
            }
        }
    }

    function handleMouseUp() {
        setIsDragging(false);
        setIsResizing(false);
        setIsRotating(false);
        setInitialState(null);
    }

    React.useEffect(() => {
        if (isDragging || isResizing || isRotating) {
            const handleMouseMoveGlobal = (e: MouseEvent) => {
                if (isDragging && initialState) {
                    const newX = ((e.clientX - dragStart.x) / containerWidth) * 100;
                    const newY = ((e.clientY - dragStart.y) / containerHeight) * 100;

                    onUpdate({
                        ...overlay,
                        x: Math.max(0, Math.min(100, newX)),
                        y: Math.max(0, Math.min(100, newY))
                    });
                } else if (isResizing && initialState && stickerRef.current) {
                    const rect = stickerRef.current.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const distance = Math.sqrt(
                        Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
                    );
                    const baseSize = 50;
                    const newScale = Math.max(0.5, Math.min(2.0, distance / baseSize));

                    onUpdate({
                        ...overlay,
                        scale: newScale
                    });
                } else if (isRotating && initialState && stickerRef.current) {
                    const rect = stickerRef.current.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

                    onUpdate({
                        ...overlay,
                        rotation: angle
                    });
                }
            };

            document.addEventListener('mousemove', handleMouseMoveGlobal);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMoveGlobal);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, isRotating, initialState, dragStart, overlay, onUpdate, containerWidth, containerHeight]);

    function handleScaleUp() {
        onUpdate({
            ...overlay,
            scale: Math.min(2.0, overlay.scale + 0.1)
        });
    }

    function handleScaleDown() {
        onUpdate({
            ...overlay,
            scale: Math.max(0.5, overlay.scale - 0.1)
        });
    }

    function handleRotate() {
        onUpdate({
            ...overlay,
            rotation: (overlay.rotation + 15) % 360
        });
    }

    // Base size: 80px for GIFs, 50px for other stickers
    const baseSize = overlay.sticker.category === 'GIF' ? 80 : 50;
    const size = baseSize * overlay.scale;

    return (
        <div
            ref={stickerRef}
            className={`absolute ${isReadOnly ? 'cursor-default' : 'cursor-move'} ${isSelected && !isReadOnly ? 'ring-2 ring-purple-500' : ''}`}
            style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                opacity: overlay.opacity,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: isSelected ? 10 : 1,
                pointerEvents: isReadOnly ? 'none' : 'auto'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Sticker Content */}
            <div className="sticker-content w-full h-full flex items-center justify-center">
                {overlay.sticker.emoji ? (
                    <span className="text-4xl" style={{ fontSize: `${size * 0.8}px` }}>
                        {overlay.sticker.emoji}
                    </span>
                ) : overlay.sticker.url ? (
                    <img
                        src={overlay.sticker.url}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            // Hide broken images
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        loading="lazy"
                        style={{ pointerEvents: 'none' }}
                    />
                ) : overlay.sticker.category === 'Text' && overlay.sticker.name ? (
                    <span
                        className="font-bold drop-shadow-lg whitespace-nowrap"
                        style={{
                            fontSize: `${size * 0.6}px`,
                            color: (overlay as any).textColor || '#FFFFFF',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)'
                        }}
                    >
                        {(overlay as any).textContent || overlay.sticker.name}
                    </span>
                ) : overlay.sticker.category === 'GIF' ? (
                    // For GIFs, only show image, no fallback text
                    null
                ) : (
                    <span className="text-white text-xs">{overlay.sticker.name}</span>
                )}
            </div>

            {/* Controls (shown when selected and not read-only) */}
            {isSelected && !isReadOnly && (
                <>
                    {/* Remove Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-20"
                    >
                        <FiX className="w-3 h-3" />
                    </button>

                    {/* Scale Controls */}
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1 bg-black/60 rounded-lg p-1 z-20">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleScaleDown();
                            }}
                            className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                        >
                            <FiMinimize2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleScaleUp();
                            }}
                            className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                        >
                            <FiMaximize2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRotate();
                            }}
                            className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                        >
                            <FiRotateCw className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Resize Handle - Larger and more visible */}
                    <div
                        className="absolute bottom-0 right-0 w-6 h-6 bg-purple-500 rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 z-20 shadow-lg border-2 border-white hover:bg-purple-600 transition-colors"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsResizing(true);
                            setInitialState({ ...overlay });
                        }}
                    />
                </>
            )}
        </div>
    );
}

