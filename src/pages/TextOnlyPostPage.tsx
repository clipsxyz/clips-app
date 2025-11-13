import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { showToast } from '../utils/toast';
import Avatar from '../components/Avatar';

export default function TextOnlyPostPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Focus text input when component mounts
        if (textInputRef.current) {
            textInputRef.current.focus();
        }
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
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black border-b border-gray-800">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/feed')}
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
                                navigate('/create/text-only/details', { state: { text: text.trim() } });
                            }
                        }}
                        disabled={!canPost}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${canPost
                            ? 'gz-animated-border bg-gray-900/30 text-white hover:bg-gray-800/50'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 py-4">
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
                    <div className="flex-1 relative">
                        {text.length === 0 && (
                            <div
                                className="absolute top-0 left-0 pointer-events-none text-xl"
                                style={{
                                    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(192,192,192,0.7) 50%, rgba(255,255,255,0.4) 100%)',
                                    backgroundSize: '200% 100%',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                    animation: 'shimmer 3s linear infinite'
                                }}
                            >
                                What's on your mind?
                            </div>
                        )}
                        <textarea
                            ref={textInputRef}
                            value={text}
                            onChange={(e) => {
                                const newText = e.target.value;
                                if (newText.length <= 280) {
                                    setText(newText);
                                }
                            }}
                            maxLength={280}
                            className="w-full bg-transparent text-white text-xl resize-none border-none outline-none min-h-[200px] focus:outline-none focus:ring-0 focus:border-none relative z-10"
                            style={{
                                fontFamily: 'inherit',
                                border: 'none',
                                outline: 'none',
                                boxShadow: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none'
                            }}
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

