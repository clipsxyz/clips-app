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
    isModalOpen?: boolean; // Whether any modal is open
}

export default function StickerOverlayComponent({
    overlay,
    onUpdate,
    onRemove,
    isSelected,
    onSelect,
    containerWidth,
    containerHeight,
    isModalOpen = false
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

    function startDrag(clientX: number, clientY: number) {
        if (isReadOnly) {
            return;
        }
        
        onSelect();
        setIsDragging(true);
        setDragStart({ x: clientX - pixelX, y: clientY - pixelY });
        setInitialState({ ...overlay });
    }

    function handleMouseDown(e: React.MouseEvent) {
        e.stopPropagation();
        // Only allow interaction if not read-only
        if (isReadOnly) {
            return; // Read-only mode
        }
        
        // Don't start dragging if clicking on controls (remove button, resize handle, etc.)
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('.cursor-nwse-resize') || target.closest('.cursor-w-resize') || target.closest('.cursor-e-resize')) {
            return; // Let controls handle their own clicks
        }
        
        startDrag(e.clientX, e.clientY);
    }

    function handleTouchStart(e: React.TouchEvent) {
        // Stop propagation FIRST to prevent container from handling it
        e.stopPropagation();
        
        if (isReadOnly) {
            return;
        }
        
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('.cursor-nwse-resize') || target.closest('.cursor-w-resize') || target.closest('.cursor-e-resize')) {
            return;
        }
        
        // Prevent default to stop scrolling/zooming
        e.preventDefault();
        
        const touch = e.touches[0];
        if (touch) {
            startDrag(touch.clientX, touch.clientY);
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

    function updatePosition(clientX: number, clientY: number) {
        if (isDragging && initialState) {
            const newX = ((clientX - dragStart.x) / containerWidth) * 100;
            const newY = ((clientY - dragStart.y) / containerHeight) * 100;

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
                Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
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
            const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);

            onUpdate({
                ...overlay,
                rotation: angle
            });
        }
    }

    // Use native event listeners for better mobile support - CRITICAL for mobile
    // Instagram-style: Handle touches at document level during drag to prevent interference
    React.useEffect(() => {
        const element = stickerRef.current;
        if (!element) return;

        // Use local variables to avoid stale closures
        let isDraggingTouch = false;
        let currentDragStart = { x: 0, y: 0 };
        let currentInitialState: StickerOverlay | null = null;
        let currentOverlay = overlay; // Capture current overlay
        let touchStartElement: HTMLElement | null = null;

        const handleNativeTouchStart = (e: TouchEvent) => {
            // Only handle if not read-only and not on a button
            if (isReadOnly) return;
            
            const target = e.target as HTMLElement;
            // Check if touch started on this sticker or its children
            if (!element.contains(target)) return;
            
            if (target.closest('button') || target.closest('.cursor-nwse-resize')) {
                return;
            }

            // Stop propagation FIRST to prevent container from handling it
            e.stopPropagation();
            e.preventDefault();
            
            const touch = e.touches[0];
            if (touch) {
                touchStartElement = target;
                onSelect();
                isDraggingTouch = true;
                setIsDragging(true);
                
                // Get the actual container element (parent of parent)
                const containerElement = element.parentElement?.parentElement || document.body;
                const containerRect = containerElement.getBoundingClientRect();
                const touchX = touch.clientX - containerRect.left;
                const touchY = touch.clientY - containerRect.top;
                
                // Calculate current sticker position in pixels
                const currentPixelX = (currentOverlay.x / 100) * containerWidth;
                const currentPixelY = (currentOverlay.y / 100) * containerHeight;
                
                // Store offset from touch point to sticker center
                currentDragStart = { 
                    x: touchX - currentPixelX, 
                    y: touchY - currentPixelY 
                };
                currentInitialState = { ...currentOverlay };
                setDragStart(currentDragStart);
                setInitialState(currentInitialState);
                
                // Add document-level listeners for touchmove/touchend to ensure we capture all events
                document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false, capture: true });
                document.addEventListener('touchend', handleDocumentTouchEnd, { passive: false, capture: true });
                document.addEventListener('touchcancel', handleDocumentTouchEnd, { passive: false, capture: true });
            }
        };

        const handleDocumentTouchMove = (e: TouchEvent) => {
            if (isDraggingTouch && currentInitialState && touchStartElement) {
                // Only handle if this touch is related to our sticker
                const touch = e.touches[0];
                if (!touch) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                // Get container - find the parent container element
                const containerElement = element.parentElement?.parentElement || document.body;
                const containerRect = containerElement.getBoundingClientRect();
                const touchX = touch.clientX - containerRect.left;
                const touchY = touch.clientY - containerRect.top;
                // Calculate new position using the drag offset
                const newPixelX = touchX - currentDragStart.x;
                const newPixelY = touchY - currentDragStart.y;
                // Convert to percentage
                const newX = (newPixelX / containerWidth) * 100;
                const newY = (newPixelY / containerHeight) * 100;
                onUpdate({
                    ...currentInitialState,
                    x: Math.max(0, Math.min(100, newX)),
                    y: Math.max(0, Math.min(100, newY))
                });
            }
        };

        const handleDocumentTouchEnd = () => {
            if (isDraggingTouch) {
                isDraggingTouch = false;
                currentInitialState = null;
                touchStartElement = null;
                setIsDragging(false);
                setIsResizing(false);
                setIsRotating(false);
                setInitialState(null);
                
                // Remove document-level listeners
                document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true } as any);
                document.removeEventListener('touchend', handleDocumentTouchEnd, { capture: true } as any);
                document.removeEventListener('touchcancel', handleDocumentTouchEnd, { capture: true } as any);
            }
        };

        // Update currentOverlay when overlay changes
        currentOverlay = overlay;

        // Add native touch listeners with capture phase for better mobile support
        // Capture phase ensures we handle events before React synthetic events and container handlers
        const options = { passive: false, capture: true };
        element.addEventListener('touchstart', handleNativeTouchStart, options);

        return () => {
            element.removeEventListener('touchstart', handleNativeTouchStart, options as any);
            document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true } as any);
            document.removeEventListener('touchend', handleDocumentTouchEnd, { capture: true } as any);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd, { capture: true } as any);
        };
    }, [isReadOnly, overlay, onSelect, onUpdate, containerWidth, containerHeight]);

    React.useEffect(() => {
        if (isDragging || isResizing || isRotating) {
            const handleMouseMoveGlobal = (e: MouseEvent) => {
                updatePosition(e.clientX, e.clientY);
            };

            const handleTouchMoveGlobal = (e: TouchEvent) => {
                if (isDragging || isResizing || isRotating) {
                    e.preventDefault(); // Prevent scrolling while dragging
                    const touch = e.touches[0];
                    if (touch) {
                        updatePosition(touch.clientX, touch.clientY);
                    }
                }
            };

            document.addEventListener('mousemove', handleMouseMoveGlobal);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
            document.addEventListener('touchend', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMoveGlobal);
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleTouchMoveGlobal);
                document.removeEventListener('touchend', handleMouseUp);
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
            data-sticker="true"
            className={`absolute ${isReadOnly ? 'cursor-default' : 'cursor-move'} ${isSelected && !isReadOnly ? 'ring-2 ring-purple-500' : ''}`}
            style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                opacity: overlay.opacity,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: isModalOpen 
                    ? 1  // Lower z-index when modals are open (modals are z-[200])
                    : (isSelected ? 100 : 50), // Higher z-index to be above textarea when no modals
                pointerEvents: isReadOnly ? 'none' : 'auto',
                touchAction: 'none', // Disable default touch behaviors to allow dragging
                userSelect: 'none', // Prevent text selection
                WebkitTouchCallout: 'none', // Disable iOS callout menu
                WebkitUserSelect: 'none', // Disable iOS text selection
                WebkitUserDrag: 'none' // Prevent dragging on WebKit
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            // Pointer events are handled by native listeners - just stop propagation
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
        >
            {/* Sticker Content */}
            <div className="sticker-content w-full h-full flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                {overlay.sticker.emoji ? (
                    <span className="text-4xl" style={{ fontSize: `${size * 0.8}px`, pointerEvents: 'none' }}>
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
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
                            pointerEvents: 'none'
                        }}
                    >
                        {(overlay as any).textContent || overlay.sticker.name}
                    </span>
                ) : overlay.sticker.category === 'Location' && overlay.sticker.name ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-full" style={{ pointerEvents: 'none' }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#EF4444' }}>
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span
                            className="font-semibold text-gray-900 whitespace-nowrap text-xs"
                            style={{
                                fontSize: `${size * 0.4}px`,
                                pointerEvents: 'none'
                            }}
                        >
                            {(overlay as any).textContent || overlay.sticker.name}
                        </span>
                    </div>
                ) : overlay.sticker.category === 'GIF' ? (
                    // For GIFs, only show image, no fallback text
                    null
                ) : (
                    <span className="text-white text-xs" style={{ pointerEvents: 'none' }}>{overlay.sticker.name}</span>
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
                        style={{ touchAction: 'none' }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsResizing(true);
                            setInitialState({ ...overlay });
                        }}
                        onTouchStart={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsResizing(true);
                            setInitialState({ ...overlay });
                        }}
                    />
                </>
            )}
        </div>
    );
}

