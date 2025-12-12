import React, { useState, useEffect, useRef } from 'react';
import { FiMusic, FiX, FiPlay, FiPause, FiSearch, FiFilter } from 'react-icons/fi';
import { getMusicLibrary, type MusicTrack } from '../api/music';

interface MusicPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTrack: (track: MusicTrack | null) => void;
    selectedTrackId?: number | null;
}

export default function MusicPicker({ isOpen, onClose, onSelectTrack, selectedTrackId }: MusicPickerProps) {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string>('');
    const [selectedMood, setSelectedMood] = useState<string>('');
    const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const genres = ['pop', 'rock', 'electronic', 'hip-hop', 'jazz', 'classical', 'ambient'];
    const moods = ['happy', 'energetic', 'calm', 'dramatic', 'romantic', 'upbeat'];

    useEffect(() => {
        if (isOpen) {
            loadTracks();
        } else {
            // Stop any playing audio when closing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingTrackId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            if (isOpen) {
                loadTracks();
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedGenre, selectedMood, isOpen]);

    const loadTracks = async () => {
        setLoading(true);
        try {
            const response = await getMusicLibrary({
                genre: selectedGenre || undefined,
                mood: selectedMood || undefined,
                search: searchQuery || undefined,
            });
            setTracks(response.data || []);
        } catch (error) {
            console.error('Failed to load music library:', error);
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayPreview = (track: MusicTrack) => {
        // Stop current track if playing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (playingTrackId === track.id) {
            setPlayingTrackId(null);
            return;
        }

        // Play new track
        const previewUrl = track.preview_url || track.url;
        if (previewUrl) {
            const audio = new Audio(previewUrl);
            audio.volume = 0.5; // Lower volume for preview
            audio.play().catch(err => {
                console.error('Failed to play preview:', err);
            });
            audioRef.current = audio;
            setPlayingTrackId(track.id);

            // Auto-stop when track ends
            audio.onended = () => {
                setPlayingTrackId(null);
                audioRef.current = null;
            };
        }
    };

    const handleSelectTrack = (track: MusicTrack) => {
        // Stop preview
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingTrackId(null);

        onSelectTrack(track);
    };

    const handleRemoveTrack = () => {
        onSelectTrack(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <FiMusic className="w-6 h-6 text-brand-500" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Select Music</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tracks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={selectedGenre}
                            onChange={(e) => setSelectedGenre(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                            <option value="">All Genres</option>
                            {genres.map(genre => (
                                <option key={genre} value={genre}>{genre.charAt(0).toUpperCase() + genre.slice(1)}</option>
                            ))}
                        </select>
                        <select
                            value={selectedMood}
                            onChange={(e) => setSelectedMood(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                            <option value="">All Moods</option>
                            {moods.map(mood => (
                                <option key={mood} value={mood}>{mood.charAt(0).toUpperCase() + mood.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Track List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                        </div>
                    ) : tracks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <FiMusic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No tracks found</p>
                            <p className="text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tracks.map((track) => {
                                const isSelected = selectedTrackId === track.id;
                                const isPlaying = playingTrackId === track.id;

                                return (
                                    <div
                                        key={track.id}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                        onClick={() => handleSelectTrack(track)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Play/Pause Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePlayPreview(track);
                                                }}
                                                className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                {isPlaying ? (
                                                    <FiPause className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                                ) : (
                                                    <FiPlay className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                                )}
                                            </button>

                                            {/* Track Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                    {track.title}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {track.artist || 'Unknown Artist'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {track.genre && (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                            {track.genre}
                                                        </span>
                                                    )}
                                                    {track.mood && (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                            {track.mood}
                                                        </span>
                                                    )}
                                                    {track.duration && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                                                        </span>
                                                    )}
                                                </div>
                                                {track.license_type && (
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        License: {track.license_type}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Indicator */}
                                            {isSelected && (
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    {selectedTrackId ? (
                        <>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Track selected
                            </div>
                            <button
                                onClick={handleRemoveTrack}
                                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                Remove
                            </button>
                        </>
                    ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Select a track or close to continue without music
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}












