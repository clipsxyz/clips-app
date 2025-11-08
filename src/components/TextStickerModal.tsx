import React from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import type { Sticker } from '../types';

interface TextStickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (text: string, fontSize: 'small' | 'medium' | 'large', color: string) => void;
}

export default function TextStickerModal({ isOpen, onClose, onConfirm }: TextStickerModalProps) {
    const [text, setText] = React.useState('');
    const [fontSize, setFontSize] = React.useState<'small' | 'medium' | 'large'>('medium');
    const [textColor, setTextColor] = React.useState('#FFFFFF');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen) {
            setText('');
            setFontSize('medium');
            setTextColor('#FFFFFF');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const colors = [
        { name: 'White', value: '#FFFFFF' },
        { name: 'Black', value: '#000000' },
        { name: 'Red', value: '#FF0000' },
        { name: 'Blue', value: '#0080FF' },
        { name: 'Green', value: '#00FF00' },
        { name: 'Yellow', value: '#FFFF00' },
        { name: 'Pink', value: '#FF00FF' },
        { name: 'Purple', value: '#8000FF' },
        { name: 'Orange', value: '#FF8000' },
        { name: 'Cyan', value: '#00FFFF' },
    ];

    function handleConfirm() {
        if (text.trim()) {
            onConfirm(text.trim(), fontSize, textColor);
            setText('');
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-full max-w-md mx-4 bg-gray-900 rounded-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Add Text</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Text Input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Text
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter your text..."
                            maxLength={50}
                            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 text-lg"
                        />
                        <div className="text-right text-xs text-gray-500 mt-1">
                            {text.length}/50
                        </div>
                    </div>

                    {/* Font Size */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Size
                        </label>
                        <div className="flex gap-2">
                            {(['small', 'medium', 'large'] as const).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setFontSize(size)}
                                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${fontSize === size
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Text Color */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Color
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {colors.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => setTextColor(color.value)}
                                    className={`aspect-square rounded-lg border-2 transition-all ${textColor === color.value
                                            ? 'border-white scale-110'
                                            : 'border-gray-700 hover:border-gray-600'
                                        }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    {text && (
                        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                            <div className="text-center">
                                <span
                                    className="font-bold drop-shadow-lg"
                                    style={{
                                        color: textColor,
                                        fontSize:
                                            fontSize === 'small'
                                                ? '24px'
                                                : fontSize === 'medium'
                                                    ? '32px'
                                                    : '40px',
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
                                    }}
                                >
                                    {text}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!text.trim()}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FiCheck className="w-4 h-4" />
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

