import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiHome, FiCamera } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import Avatar from '../components/Avatar';
import { getAvatarForHandle } from '../api/users';
import type { StickerOverlay } from '../types';

export default function ReplyQuestionPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const cameraInputRef = React.useRef<HTMLInputElement>(null);
    
    const replyData = location.state?.replyToQuestion as {
        question: string;
        response: string;
        responderHandle: string;
        questionId?: string;
    } | undefined;
    
    const [replyText, setReplyText] = React.useState('');
    const [selectedMedia, setSelectedMedia] = React.useState<string | null>(null);
    const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    
    // Redirect if no reply data
    React.useEffect(() => {
        if (!replyData) {
            navigate('/feed');
        }
    }, [replyData, navigate]);
    
    if (!replyData) {
        return null;
    }
    
    const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setSelectedMedia(result);
                if (file.type.startsWith('image/')) {
                    setMediaType('image');
                } else if (file.type.startsWith('video/')) {
                    setMediaType('video');
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const handleCameraClick = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };
    
    const handleSubmit = async () => {
        if (!replyText.trim()) {
            alert('Please enter your reply.');
            return;
        }
        if (!user) return;
        
        setIsUploading(true);
        try {
            // Create question card sticker with responder's username
            const questionCardSticker: StickerOverlay = {
                id: `question-card-${Date.now()}`,
                stickerId: `question-card-${Date.now()}`,
                sticker: {
                    id: `question-card-${Date.now()}`,
                    name: 'Question Card',
                    category: 'Question',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50, // Center horizontally
                y: 30, // Position at top (30% from top)
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: `${replyData.responderHandle}\nQ: ${replyData.question}\nA: ${replyData.response}`,
                textColor: '#000000',
                fontSize: 'small',
                isQuestionCard: true
            };
            
            // Your reply text as a sticker at the bottom
            const replySticker: StickerOverlay = {
                id: `reply-sticker-${Date.now()}`,
                stickerId: `reply-sticker-${Date.now()}`,
                sticker: {
                    id: `reply-sticker-${Date.now()}`,
                    name: 'Your Reply',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75, // Position at bottom
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: replyText.trim(),
                textColor: '#FFFFFF',
                fontSize: 'medium'
            };
            
            const allStickers = [questionCardSticker, replySticker];
            
            const createdStory = await createStory(
                user.id,
                user.handle,
                selectedMedia || undefined,
                mediaType || undefined,
                undefined, // text
                undefined, // location
                undefined, // textColor
                undefined, // textSize
                undefined, // sharedPostInfo
                undefined, // sharedFromUser
                undefined, // textStyle
                allStickers,
                undefined, // taggedUsers
                undefined, // poll
                undefined, // taggedUsersPositions
                undefined // question
            );
            
            // Mark question as replied if this was a question reply
            if (replyData.questionId) {
                const { markQuestionReplied } = await import('../api/questions');
                await markQuestionReplied(replyData.questionId, createdStory.id);
            }
            
            // Dispatch event to refresh story indicators
            window.dispatchEvent(new CustomEvent('storyCreated', {
                detail: { userHandle: user.handle }
            }));
            
            navigate('/feed');
        } catch (error) {
            console.error('Error creating reply story:', error);
            alert('Failed to post reply. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black z-50 overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/feed')}
                            className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                            aria-label="Go to Home Feed"
                        >
                            <FiHome className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/feed')}
                            className="font-light text-base tracking-tight"
                            style={{ 
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}
                        >
                            <span
                                style={{
                                    background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.3) 100%)',
                                    backgroundSize: '200% 100%',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                    animation: 'shimmer 3s linear infinite',
                                    display: 'inline-block'
                                }}
                            >
                                Gazetteer
                            </span>
                        </button>
                    </div>
                    <h1 className="text-white font-semibold text-base">Reply to Question</h1>
                    <div className="w-12" /> {/* Spacer for centering */}
                </div>
            </div>
            
            {/* Main Content */}
            <div className="w-full h-full flex items-center justify-center bg-black pt-16 pb-32">
                <div className="w-full max-w-md px-4 space-y-6">
                    {/* Question Card */}
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-purple-500">
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar
                                name={replyData.responderHandle}
                                src={getAvatarForHandle(replyData.responderHandle)}
                                size="sm"
                            />
                            <div>
                                <p className="font-semibold text-sm text-gray-900">
                                    {replyData.responderHandle}
                                </p>
                                <p className="text-xs text-gray-500">asked you</p>
                            </div>
                        </div>
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Question:</p>
                            <p className="text-sm text-gray-900 font-bold">{replyData.question}</p>
                        </div>
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Reply:</p>
                            <p className="text-base text-gray-800 font-semibold">{replyData.response}</p>
                        </div>
                    </div>
                    
                    {/* Your Reply Input */}
                    <div className="bg-gray-900 rounded-2xl p-4">
                        <label className="block text-white text-sm font-semibold mb-2">
                            Your Reply:
                        </label>
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply..."
                            maxLength={200}
                            className="w-full h-32 p-4 rounded-xl bg-gray-800 text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <div className="text-right text-sm text-gray-500 mt-2">{replyText.length}/200</div>
                    </div>
                    
                    {/* Background Image Preview */}
                    {selectedMedia && mediaType === 'image' && (
                        <div className="relative rounded-2xl overflow-hidden">
                            <img
                                src={selectedMedia}
                                alt="Background"
                                className="w-full h-64 object-cover"
                            />
                            <button
                                onClick={() => {
                                    setSelectedMedia(null);
                                    setMediaType(null);
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    {/* Background Image Preview for Video */}
                    {selectedMedia && mediaType === 'video' && (
                        <div className="relative rounded-2xl overflow-hidden">
                            <video
                                src={selectedMedia}
                                className="w-full h-64 object-cover"
                                controls
                            />
                            <button
                                onClick={() => {
                                    setSelectedMedia(null);
                                    setMediaType(null);
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md p-4 border-t border-gray-800">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        {/* Add Background Image Button */}
                        <button
                            onClick={handleCameraClick}
                            className="relative p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors"
                            aria-label="Take Photo or Video"
                        >
                            <FiCamera className="w-5 h-5" />
                            {/* Plus icon on border */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white text-[10px] font-bold">+</span>
                            </div>
                        </button>
                        
                        {/* Select Photo or Video Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Select Photo or Video
                        </button>
                    </div>
                    
                    {/* Hidden Camera Input */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*,video/*"
                        capture="user"
                        onChange={handleMediaSelect}
                        className="hidden"
                    />
                    
                    {/* Hidden File Input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleMediaSelect}
                        className="hidden"
                    />
                    
                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isUploading || !replyText.trim()}
                        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? 'Posting...' : 'Post Reply'}
                    </button>
                </div>
            </div>
        </div>
    );
}
