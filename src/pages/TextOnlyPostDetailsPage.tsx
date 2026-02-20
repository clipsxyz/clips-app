import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMapPin, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { showToast } from '../utils/toast';
import UserTaggingModal from '../components/UserTaggingModal';

export default function TextOnlyPostDetailsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const text = (location.state as { text?: string })?.text || '';
    const containerRef = useRef<HTMLDivElement>(null);
    const textPreviewRef = useRef<HTMLDivElement>(null);

    const [locationText, setLocationText] = useState('');
    const [venueText, setVenueText] = useState('');
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showUserTagging, setShowUserTagging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Scroll to top when component mounts - use useLayoutEffect to run before paint
    useLayoutEffect(() => {
        // Disable scroll restoration temporarily
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        
        // Scroll main container if it exists (this is likely the scrollable container)
        const mainElement = document.getElementById('main');
        if (mainElement) {
            mainElement.scrollTop = 0;
            mainElement.scrollTo(0, 0);
        }
        
        // Scroll window and document
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, []);

    // Also use useEffect as backup with multiple attempts
    useEffect(() => {
        const scrollToTop = () => {
            // Find and scroll the main container (this is the scrollable element in App.tsx)
            const mainElement = document.getElementById('main');
            if (mainElement) {
                mainElement.scrollTop = 0;
                mainElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
            
            // Scroll window
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            
            // Scroll this component's container
            if (containerRef.current) {
                containerRef.current.scrollTop = 0;
                containerRef.current.scrollTo(0, 0);
            }
            
            // Scroll to text preview if it exists
            if (textPreviewRef.current) {
                textPreviewRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
        };

        // Immediate
        scrollToTop();
        
        // Multiple delayed attempts
        const timeouts = [
            setTimeout(scrollToTop, 0),
            setTimeout(scrollToTop, 10),
            setTimeout(scrollToTop, 50),
            setTimeout(scrollToTop, 100),
            setTimeout(scrollToTop, 200)
        ];
        
        // Animation frame attempts
        requestAnimationFrame(() => {
            scrollToTop();
            requestAnimationFrame(() => {
                scrollToTop();
                requestAnimationFrame(scrollToTop);
            });
        });

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, [text]);

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
                locationText.trim(), // location
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
                taggedUsers.length > 0 ? taggedUsers : undefined, // taggedUsers
                undefined, // videoCaptionsEnabled
                undefined, // videoCaptionText
                undefined, // subtitlesEnabled
                undefined, // subtitleText
                undefined, // editTimeline
                undefined, // musicTrackId
                venueText.trim() || undefined // venue
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
        <div ref={containerRef} className="min-h-screen bg-black flex flex-col" style={{ overflowY: 'auto' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black border-b border-gray-800 flex-shrink-0">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/create/text-only', { state: { text } })}
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
                        onClick={handleSubmit}
                        disabled={!canPost || isSubmitting}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${canPost && !isSubmitting
                            ? 'gz-animated-border bg-gray-900/30 text-white hover:bg-gray-800/50'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>

            {/* Text Preview Box - Show at top */}
            {text && (
                <div ref={textPreviewRef} className="px-4 pt-4 pb-4 border-b border-gray-800 flex-shrink-0">
                    <div className="p-4 rounded-xl bg-gray-900/30 border border-gray-800">
                        <div className="text-white text-base whitespace-pre-wrap break-words">
                            {text}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto" data-main-content style={{ scrollBehavior: 'smooth' }}>
                {/* Location Input */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-900/30 border border-gray-800">
                    <FiMapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        value={locationText}
                        onChange={(e) => setLocationText(e.target.value)}
                        placeholder="Add location"
                        className="flex-1 bg-transparent text-white placeholder-gray-500 text-base border-none outline-none"
                    />
                </div>

                {/* Venue Input - shown in metadata carousel on feed */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-900/30 border border-gray-800">
                    <FiMapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        value={venueText}
                        onChange={(e) => setVenueText(e.target.value)}
                        placeholder="Add venue (e.g. café, stadium)"
                        className="flex-1 bg-transparent text-white placeholder-gray-500 text-base border-none outline-none"
                    />
                </div>

                {/* Tag Users */}
                <button
                    onClick={() => setShowUserTagging(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-900/30 border border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                    <FiUser className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-left">
                        <div className="text-white font-medium">
                            Tag People
                        </div>
                        <div className="text-gray-400 text-sm">
                            {taggedUsers.length > 0
                                ? `${taggedUsers.length} ${taggedUsers.length === 1 ? 'person' : 'people'} tagged`
                                : 'Tag someone in your post'
                            }
                        </div>
                    </div>
                    {taggedUsers.length > 0 && (
                        <div className="flex items-center gap-1">
                            {taggedUsers.slice(0, 2).map((handle) => (
                                <div key={handle} className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-semibold">
                                    {handle.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {taggedUsers.length > 2 && (
                                <div className="w-6 h-6 rounded-full bg-gray-600 text-gray-300 text-xs flex items-center justify-center font-semibold">
                                    +{taggedUsers.length - 2}
                                </div>
                            )}
                        </div>
                    )}
                </button>

            </div>

            {/* User Tagging Modal */}
            <UserTaggingModal
                isOpen={showUserTagging}
                onClose={() => setShowUserTagging(false)}
                onSelectUser={(handle) => {
                    if (!taggedUsers.includes(handle)) {
                        setTaggedUsers([...taggedUsers, handle]);
                    }
                }}
                taggedUsers={taggedUsers}
            />
        </div>
    );
}







