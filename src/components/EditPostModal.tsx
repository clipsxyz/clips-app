import React, { useState, useEffect } from 'react';
import { FiX, FiMapPin } from 'react-icons/fi';
import { Post } from '../types';

interface EditPostModalProps {
    post: Post;
    isOpen: boolean;
    onClose: () => void;
    onSave: (text: string, location: string, venue: string) => Promise<void>;
}

export default function EditPostModal({
    post,
    isOpen,
    onClose,
    onSave
}: EditPostModalProps) {
    const [text, setText] = useState('');
    const [location, setLocation] = useState('');
    const [venue, setVenue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setText(post.text || post.text_content || '');
            setLocation(post.locationLabel || '');
            setVenue(post.venue || '');
            setError(null);
        }
    }, [isOpen, post]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (isSaving) return;

        setError(null);
        setIsSaving(true);

        try {
            await onSave(text.trim(), location.trim(), venue.trim());
            onClose();
        } catch (err: any) {
            const isConnectionError =
                err?.message === 'CONNECTION_REFUSED' ||
                err?.name === 'ConnectionRefused' ||
                err?.message?.includes('Failed to fetch') ||
                err?.message?.includes('ERR_CONNECTION_REFUSED') ||
                err?.message?.includes('NetworkError');

            if (isConnectionError) {
                setError('Backend server is not running. Please start the Laravel backend server (php artisan serve) and try again.');
            } else {
                setError(err.message || 'Failed to update post');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        if (!isSaving) onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
            {/* Backdrop – same as new Swal */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />
            {/* Bottom sheet: new Swal style – black bg, white text, rounded top */}
            <div className="relative w-full max-w-[min(400px,calc(100vw-32px))] bg-[#1a1a1a] rounded-t-[24px] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                {/* Drag handle */}
                <div className="flex justify-center pt-2.5 pb-2">
                    <div className="w-10 h-0.5 bg-white/30 rounded-full" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3">
                    <h2 className="text-lg font-semibold text-white">Edit Post</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-sm">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">Text</label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full px-3 py-2.5 rounded-lg bg-[#1f1f23] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                            rows={4}
                            maxLength={500}
                            disabled={isSaving}
                        />
                        <div className="text-xs text-white/50 mt-1 text-right">{text.length}/500</div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">Location</label>
                        <div className="relative">
                            <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Add location"
                                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-[#1f1f23] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                                maxLength={200}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">Venue</label>
                        <div className="relative">
                            <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                            <input
                                type="text"
                                value={venue}
                                onChange={(e) => setVenue(e.target.value)}
                                placeholder="Add venue (e.g. café, stadium)"
                                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-[#1f1f23] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                                maxLength={200}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>
                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-xl text-white/90 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
