import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { showToast } from '../utils/toast';
import Avatar from '../components/Avatar';

export default function TextOnlyPostPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Check if this is being called as a clip for a multi-clip post
    const locationState = location.state as any;
    const isClip = locationState?.isClip === true;
    const clipId = locationState?.clipId;
    const templateId = locationState?.templateId;

    useEffect(() => {
        // Don't auto-focus - let user click to focus
        // This prevents focus/blur loops
    }, []);

    const handleSubmit = async () => {
        if (!text.trim()) {
            showToast('Please add some text to your post');
            return;
        }
        if (!user) {
            showToast('Please log in to create a post');
            return;
        }

        setIsSubmitting(true);
        try {
            await createPost(
                user.id,
                user.handle,
                text.trim(), // text
                '', // location
                undefined, // imageUrl
                undefined, // mediaType
                undefined, // imageText
                undefined, // caption
                user.local,
                user.regional,
                user.national,
                undefined, // stickers
                undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                { color: '#ffffff', size: 'medium', background: '#000000' }, // textStyle
                undefined // taggedUsers
            );

            window.dispatchEvent(new CustomEvent('postCreated'));
            showToast('Post created successfully!');
            navigate('/feed');
        } catch (error) {
            console.error('Error creating post:', error);
            showToast('Failed to create post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canPost = text.trim().length > 0;

    return (
        <div className="min-h-screen bg-black" style={{ pointerEvents: 'auto' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black border-b border-gray-800">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (isClip) {
                                    // Return to template editor
                                    navigate('/template-editor', {
                                        state: {
                                            template: { id: templateId }
                                        }
                                    });
                                } else {
                                    navigate('/feed');
                                }
                            }}
                            className="p-2 -ml-2 text-white hover:bg-gray-900 rounded-full transition-colors"
                            aria-label="Back"
                        >
                            <FiChevronLeft className="w-6 h-6" />
                        </button>
                        {/* Gazetteer Logo */}
                        <div className="relative p-0.5 rounded border border-white">
                            <div className="p-0.5 rounded border border-white">
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <FiMapPin className="text-white" size={20} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (canPost) {
                                if (isClip) {
                                    // If this is a clip, return to template editor with the text data
                                    // Restore template from sessionStorage to pass it in navigation
                                    const savedState = sessionStorage.getItem('templateEditorState');
                                    let templateToPass = null;
                                    if (savedState) {
                                        try {
                                            const state = JSON.parse(savedState);
                                            templateToPass = state.template;
                                        } catch (e) {
                                            console.error('Error reading template from sessionStorage:', e);
                                        }
                                    }
                                    
                                    navigate('/template-editor', {
                                        state: {
                                            template: templateToPass || { id: templateId },
                                            textClipData: {
                                                text: text.trim(),
                                                textStyle: { color: '#ffffff', size: 'medium', background: '#000000' },
                                                clipId: clipId
                                            },
                                            clipId: clipId
                                        }
                                    });
                                } else {
                                    // Normal flow: go to details page
                                    navigate('/create/text-only/details', { state: { text: text.trim() } });
                                }
                            }
                        }}
                        disabled={!canPost}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${canPost
                            ? 'gz-animated-border bg-gray-900/30 text-white hover:bg-gray-800/50'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                            }`}
                        style={{
                            visibility: 'visible',
                            display: 'block'
                        }}
                    >
                        {isClip ? 'Add to Post' : 'Next'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 pt-6 pb-4">
                <div className="flex gap-4">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                        <Avatar
                            src={user?.avatarUrl}
                            name={user?.name || 'User'}
                            size="md"
                        />
                    </div>

                    {/* Text Input */}
                    <div className="flex-1">
                        <textarea
                            ref={textInputRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="What's on your mind?"
                            maxLength={280}
                            className="w-full bg-gray-900/30 text-white text-xl resize-none border border-gray-700 rounded-lg outline-none min-h-[200px] px-4 py-3 focus:outline-none focus:ring-0 focus:border-gray-600 placeholder:text-gray-500"
                            rows={8}
                        />
                        {/* Character count */}
                        <div className="flex justify-end mt-2">
                            <span className={`text-sm ${text.length > 260
                                ? text.length >= 280
                                    ? 'text-red-500'
                                    : 'text-yellow-500'
                                : 'text-gray-500'
                                }`}>
                                {text.length}/280
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

