import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Post } from '../types';
import { FiX, FiDownload } from 'react-icons/fi';

interface QRCodeModalProps {
    post: Post;
    isOpen: boolean;
    onClose: () => void;
}

// Format date for display (e.g., "DEC 12, 2025")
function formatPostDate(timestamp: number | string): string {
    const date = typeof timestamp === 'string' ? new Date(parseInt(timestamp)) : new Date(timestamp);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

export default function QRCodeModal({ post, isOpen, onClose }: QRCodeModalProps) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isOpen && post && post.id) {
            // Reset QR code when modal opens
            setQrCodeDataUrl('');
            setIsGenerating(true);
            generateQRCodeWithGradient();
        } else if (!isOpen) {
            // Reset when modal closes
            setQrCodeDataUrl('');
            setIsGenerating(false);
        }
    }, [isOpen, post?.id]);

    async function generateQRCodeWithGradient() {
        if (!post || !post.id) {
            console.error('QRCodeModal: Post or post.id is missing', post);
            setIsGenerating(false);
            return;
        }

        setIsGenerating(true);
        try {
            // Generate post URL
            const postUrl = `${window.location.origin}/post/${post.id}`;
            console.log('QRCodeModal: Generating QR code for URL:', postUrl);

            // Generate QR code as data URL (black on white)
            const qrDataUrl = await QRCode.toDataURL(postUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            console.log('QRCodeModal: QR code generated, length:', qrDataUrl.length);

            // Create a canvas to apply gradient and add logos
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.warn('QRCodeModal: Canvas context not available, using basic QR code');
                setQrCodeDataUrl(qrDataUrl);
                setIsGenerating(false);
                return;
            }

            // Draw white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 300, 300);

            // Load the QR code image
            const qrImage = new Image();
            qrImage.src = qrDataUrl;

            await new Promise<void>((resolve, reject) => {
                qrImage.onload = () => {
                    try {
                        // Draw QR code
                        ctx.drawImage(qrImage, 0, 0, 300, 300);

                        // Get image data to apply gradient only to black pixels
                        const imageData = ctx.getImageData(0, 0, 300, 300);
                        const data = imageData.data;

                        // Create gradient (matching progress bar: #ec4899 -> #a855f7 -> #7c3aed)
                        // Apply gradient to black pixels only
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];

                            // If pixel is black (or very dark), apply gradient color
                            if (r < 128 && g < 128 && b < 128) {
                                const x = (i / 4) % 300;
                                const y = Math.floor((i / 4) / 300);

                                // Calculate gradient position (diagonal from top-left to bottom-right)
                                const gradientPos = (x + y) / 600; // 0 to 1

                                // Calculate gradient color
                                let finalR, finalG, finalB;
                                if (gradientPos < 0.5) {
                                    // Interpolate between pink and light purple
                                    const t = gradientPos * 2;
                                    finalR = Math.round(236 + (168 - 236) * t); // #ec4899 to #a855f7
                                    finalG = Math.round(72 + (85 - 72) * t);
                                    finalB = Math.round(153 + (247 - 153) * t);
                                } else {
                                    // Interpolate between light purple and dark purple
                                    const t = (gradientPos - 0.5) * 2;
                                    finalR = Math.round(168 + (124 - 168) * t); // #a855f7 to #7c3aed
                                    finalG = Math.round(85 + (58 - 85) * t);
                                    finalB = Math.round(247 + (237 - 247) * t);
                                }

                                data[i] = finalR;
                                data[i + 1] = finalG;
                                data[i + 2] = finalB;
                            }
                        }

                        // Put the modified image data back
                        ctx.putImageData(imageData, 0, 0);

                        // Create gradient for logos (matching progress bar: #ec4899 -> #a855f7 -> #7c3aed)
                        const gradient = ctx.createLinearGradient(0, 0, 300, 300);
                        gradient.addColorStop(0, '#ec4899'); // Pink
                        gradient.addColorStop(0.5, '#a855f7'); // Light purple
                        gradient.addColorStop(1, '#7c3aed'); // Dark purple

                        // Draw Instagram camera logos in corners
                        const logoSize = 40;
                        const cornerPositions = [
                            { x: 20, y: 20 }, // Top-left
                            { x: 300 - 20 - logoSize, y: 20 }, // Top-right
                            { x: 20, y: 300 - 20 - logoSize }, // Bottom-left
                        ];

                        cornerPositions.forEach((pos) => {
                            // Draw circle background with gradient
                            ctx.beginPath();
                            ctx.arc(pos.x + logoSize / 2, pos.y + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                            ctx.fillStyle = gradient;
                            ctx.fill();

                            // Draw white circle inside
                            ctx.beginPath();
                            ctx.arc(pos.x + logoSize / 2, pos.y + logoSize / 2, logoSize / 2 - 3, 0, Math.PI * 2);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fill();

                            // Draw camera icon (simplified square with gradient)
                            ctx.fillStyle = gradient;
                            ctx.fillRect(pos.x + logoSize / 4, pos.y + logoSize / 4, logoSize / 2, logoSize / 2);
                        });

                        const finalDataUrl = canvas.toDataURL('image/png');
                        console.log('QRCodeModal: Final QR code generated, length:', finalDataUrl.length);
                        setQrCodeDataUrl(finalDataUrl);
                        setIsGenerating(false);
                        resolve();
                    } catch (error) {
                        console.error('QRCodeModal: Error processing QR code:', error);
                        setIsGenerating(false);
                        reject(error);
                    }
                };
                qrImage.onerror = (error) => {
                    console.error('QRCodeModal: Error loading QR code image:', error);
                    setIsGenerating(false);
                    reject(new Error('Failed to load QR code image'));
                };
            });
        } catch (error) {
            console.error('QRCodeModal: Error generating QR code:', error);
            // Fallback: try to generate a basic QR code without gradient
            try {
                if (post && post.id) {
                    const postUrl = `${window.location.origin}/post/${post.id}`;
                    const basicQr = await QRCode.toDataURL(postUrl, {
                        width: 300,
                        margin: 2
                    });
                    setQrCodeDataUrl(basicQr);
                    console.log('QRCodeModal: Fallback QR code generated');
                }
            } catch (fallbackError) {
                console.error('QRCodeModal: Fallback QR code generation also failed:', fallbackError);
            }
            setIsGenerating(false);
        }
    }

    function handleSaveQRCode() {
        if (!qrCodeDataUrl) return;

        // Create a download link
        const link = document.createElement('a');
        link.download = `post-${post.id}-qr-code.png`;
        link.href = qrCodeDataUrl;
        link.click();
    }

    if (!isOpen) return null;

    const postDate = post.createdAt ? formatPostDate(post.createdAt) : 'Unknown date';
    const username = post.userHandle || 'Unknown user';
    const displayUsername = username.split('@')[0]?.toUpperCase() || 'UNKNOWN';

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm mx-4 bg-[#262626] dark:bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                    aria-label="Close"
                >
                    <FiX className="w-5 h-5 text-white" />
                </button>

                {/* Content */}
                <div className="p-6">
                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            {qrCodeDataUrl ? (
                                <img
                                    src={qrCodeDataUrl}
                                    alt="QR Code"
                                    className="w-64 h-64 rounded-2xl"
                                    onError={(e) => {
                                        console.error('QRCodeModal: Error displaying QR code image');
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="w-64 h-64 rounded-2xl bg-white flex flex-col items-center justify-center gap-2">
                                    {isGenerating ? (
                                        <>
                                            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs text-gray-500">Generating QR code...</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500">Failed to generate QR code</p>
                                    )}
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                    </div>

                    {/* Post Info with Gradient Text */}
                    <div className="text-center mb-4">
                        <div
                            className="text-sm font-medium mb-1"
                            style={{
                                background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                            }}
                        >
                            POST SHARED ON {postDate.toUpperCase()}
                        </div>
                        <div
                            className="text-sm font-medium mb-4"
                            style={{
                                background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                            }}
                        >
                            BY @{displayUsername}
                        </div>
                        <p className="text-white text-sm text-gray-300 px-4">
                            People can scan this QR code with their smartphone's camera to see this post.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3 mt-6">
                        <button
                            onClick={handleSaveQRCode}
                            disabled={!qrCodeDataUrl || isGenerating}
                            className="w-full py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FiDownload className="w-5 h-5" />
                            Save QR code
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
