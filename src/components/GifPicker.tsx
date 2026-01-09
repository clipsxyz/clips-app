import React, { useState, useEffect } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';

interface GifPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectGif: (gifUrl: string) => void;
}

// Popular GIFs for demonstration (in production, you'd use Giphy API or similar)
const popularGifs = [
    { id: '1', url: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif', title: 'Happy' },
    { id: '2', url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', title: 'Excited' },
    { id: '3', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', title: 'Laughing' },
    { id: '4', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Dancing' },
    { id: '5', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnby/giphy.gif', title: 'Celebrating' },
    { id: '6', url: 'https://media.giphy.com/media/3o7aD2saQ5D3zVLWfu/giphy.gif', title: 'Thumbs Up' },
    { id: '7', url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', title: 'Love' },
    { id: '8', url: 'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/giphy.gif', title: 'Applause' },
];

export default function GifPicker({ isOpen, onClose, onSelectGif }: GifPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [gifs, setGifs] = useState(popularGifs);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setGifs(popularGifs);
            setSearchQuery('');
        }
    }, [isOpen]);

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setGifs(popularGifs);
            return;
        }

        setIsLoading(true);
        try {
            // In production, you would call Giphy API here
            // For now, filter the popular GIFs by title
            const filtered = popularGifs.filter(gif => 
                gif.title.toLowerCase().includes(query.toLowerCase())
            );
            setGifs(filtered.length > 0 ? filtered : popularGifs);
        } catch (error) {
            console.error('Error searching GIFs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectGif = (gifUrl: string) => {
        onSelectGif(gifUrl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-full max-w-md max-h-[80vh] bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Choose a GIF</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                handleSearch(e.target.value);
                            }}
                            placeholder="Search GIFs..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* GIF Grid */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : gifs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No GIFs found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {gifs.map((gif) => (
                                <button
                                    key={gif.id}
                                    onClick={() => handleSelectGif(gif.url)}
                                    className="aspect-square rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors overflow-hidden relative group cursor-pointer"
                                >
                                    <img
                                        src={gif.url}
                                        alt={gif.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

