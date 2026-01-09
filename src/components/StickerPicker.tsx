import React from 'react';
import { FiX, FiSearch, FiType } from 'react-icons/fi';
import { getStickers, STICKER_CATEGORIES, searchStickers } from '../api/stickers';
import type { Sticker } from '../types';

interface StickerPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSticker: (sticker: Sticker) => void;
    onAddText?: () => void;
}

export default function StickerPicker({ isOpen, onClose, onSelectSticker, onAddText }: StickerPickerProps) {
    const [stickers, setStickers] = React.useState<Sticker[]>([]);
    const [selectedCategory, setSelectedCategory] = React.useState<string>('Emoji');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            loadStickers();
        }
    }, [isOpen, selectedCategory]);

    React.useEffect(() => {
        if (searchQuery.trim()) {
            handleSearch(searchQuery);
        } else {
            loadStickers();
        }
    }, [searchQuery]);

    async function loadStickers() {
        setIsLoading(true);
        try {
            const fetchedStickers = await getStickers(selectedCategory);
            setStickers(fetchedStickers);
        } catch (error) {
            console.error('Error loading stickers:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSearch(query: string) {
        if (!query.trim()) {
            loadStickers();
            return;
        }

        setIsLoading(true);
        try {
            const results = await searchStickers(query);
            setStickers(results);
        } catch (error) {
            console.error('Error searching stickers:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleSelectSticker(sticker: Sticker) {
        onSelectSticker(sticker);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end animate-in fade-in duration-200">
            <div className="w-full bg-gray-900 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="px-4 pt-4 pb-2 border-b border-gray-800">
                    <div className="h-1 w-12 bg-gray-700 rounded-full mx-auto mb-4" />
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Stickers</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search stickers..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                        />
                    </div>

                    {/* Category Tabs */}
                    {!searchQuery && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                            {STICKER_CATEGORIES.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Add Text Button */}
                    {onAddText && (
                        <button
                            onClick={() => {
                                onAddText();
                                onClose();
                            }}
                            className="w-full mt-2 mb-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <FiType className="w-4 h-4" />
                            <span>Add Text</span>
                        </button>
                    )}
                </div>

                {/* Stickers Grid */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : stickers.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No stickers found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 gap-3">
                            {stickers.map((sticker) => (
                                <button
                                    key={sticker.id}
                                    onClick={() => handleSelectSticker(sticker)}
                                    className="aspect-square rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors flex items-center justify-center text-3xl relative group cursor-pointer"
                                >
                                    {sticker.emoji ? (
                                        <span className="text-4xl">{sticker.emoji}</span>
                                    ) : sticker.url ? (
                                        <img
                                            src={sticker.url}
                                            alt={sticker.name}
                                            className="w-full h-full object-contain rounded-xl"
                                        />
                                    ) : (
                                        <span className="text-gray-500 text-sm">{sticker.name}</span>
                                    )}
                                    {sticker.isTrending && (
                                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                                    )}
                                    {/* Tooltip on hover */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        {sticker.name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

