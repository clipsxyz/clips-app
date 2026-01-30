import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiX, FiImage, FiVideo, FiPlus, FiSmile, FiUser, FiChevronLeft, FiChevronRight, FiType, FiMessageSquare, FiMapPin } from 'react-icons/fi';
import { VideoTemplate, StickerOverlay, Sticker } from '../types';
import { incrementTemplateUsage } from '../api/templates';
import { createPost } from '../api/posts';
import { useAuth } from '../context/Auth';
import { TEMPLATE_IDS, TEMPLATE_GRADIENTS, MAX_CLIPS, MAX_CLIPS_CAROUSEL, MIN_CLIPS, DEFAULT_CLIP_DURATION, ANIMATION_DURATIONS } from '../constants';
import StickerPicker from '../components/StickerPicker';
import { transcribeVideo } from '../utils/transcription';
import StickerOverlayComponent from '../components/StickerOverlay';
import TextStickerModal from '../components/TextStickerModal';
import UserTaggingModal from '../components/UserTaggingModal';
import EffectWrapper from '../components/EffectWrapper';
import type { EffectConfig } from '../utils/effects';
import { pickFiles, filterFilesByPlatform, type PlatformType } from '../utils/filePicker';
import { isWeb } from '../utils/platform';
import Swal from 'sweetalert2';

type UserMedia = {
    clipId: string;
    url: string;
    mediaType: 'image' | 'video';
    file?: File;
};

export default function TemplateEditorPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const locationStateTemplate = (location.state as { template?: VideoTemplate })?.template;
    
    // Try to get template from location state, or restore from sessionStorage
    const [template, setTemplate] = React.useState<VideoTemplate | undefined>(locationStateTemplate);
    
    // Restore template from location state or sessionStorage
    React.useEffect(() => {
        if (locationStateTemplate) {
            // Template in location state takes priority
            setTemplate(locationStateTemplate);
        } else if (!template) {
            // Try to restore from sessionStorage
            const savedState = sessionStorage.getItem('templateEditorState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    if (state.template) {
                        setTemplate(state.template);
                    }
                } catch (e) {
                    console.error('Error restoring template from sessionStorage:', e);
                }
            }
        }
    }, [locationStateTemplate, template]);

    const [userMedia, setUserMedia] = React.useState<Map<string, UserMedia>>(new Map());
    const [textOnlyClips, setTextOnlyClips] = React.useState<Map<string, { text: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>>(new Map()); // clipId -> text content
    const [currentClipIndex, setCurrentClipIndex] = React.useState(0);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [text, setText] = React.useState('');
    const [locationLabel, setLocationLabel] = React.useState('');
    const [bannerText, setBannerText] = React.useState('');
    const [captionsEnabled, setCaptionsEnabled] = React.useState(false);
    const [videoCaptionText, setVideoCaptionText] = React.useState('');
    const [subtitlesEnabled, setSubtitlesEnabled] = React.useState(false);
    const [subtitleText, setSubtitleText] = React.useState('');
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [stickers, setStickers] = React.useState<Map<string, StickerOverlay[]>>(new Map()); // clipId -> stickers
    const [showStickerPicker, setShowStickerPicker] = React.useState(false);
    const [showTextStickerModal, setShowTextStickerModal] = React.useState(false);
    const [selectedStickerOverlay, setSelectedStickerOverlay] = React.useState<string | null>(null);
    const [taggedUsers, setTaggedUsers] = React.useState<string[]>([]);
    const [showUserTagging, setShowUserTagging] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState<'media' | 'details'>('media');
    const mediaContainerRef = React.useRef<HTMLDivElement>(null);
    const postDetailsRef = React.useRef<HTMLDivElement>(null);
    const isAddingClipRef = React.useRef(false); // Prevent multiple rapid clicks
    
    // Immediately scroll to top on mount (before any rendering)
    React.useLayoutEffect(() => {
        // Force scroll to top using all methods
        window.scrollTo(0, 0);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (document.scrollingElement) {
            (document.scrollingElement as HTMLElement).scrollTop = 0;
        }
        // Also try scrolling the main element if it exists
        const mainElement = document.getElementById('main');
        if (mainElement) {
            mainElement.scrollTop = 0;
        }
    }, []);
    
    // Also scroll to top when location/template changes
    React.useEffect(() => {
        const scrollToTop = () => {
            window.scrollTo(0, 0);
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            if (document.scrollingElement) {
                (document.scrollingElement as HTMLElement).scrollTop = 0;
            }
            const mainElement = document.getElementById('main');
            if (mainElement) {
                mainElement.scrollTop = 0;
            }
        };
        
        // Scroll immediately
        scrollToTop();
        
        // Also try after a short delay to catch any late renders
        const timeout = setTimeout(scrollToTop, 0);
        const timeout2 = setTimeout(scrollToTop, 50);
        const timeout3 = setTimeout(scrollToTop, 100);
        
        return () => {
            clearTimeout(timeout);
            clearTimeout(timeout2);
            clearTimeout(timeout3);
        };
    }, [location.pathname, template?.id]);
    
    // Force scroll to Post Details when on details step
    React.useEffect(() => {
        if (currentStep === 'details') {
            // First, scroll to absolute top to reset
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            
            const scrollToPostDetails = () => {
                const element = document.getElementById('post-details-section');
                if (element) {
                    // Get the element's position
                    const rect = element.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const elementTop = rect.top + scrollTop;
                    
                    // Force scroll using all methods
                    window.scrollTo({
                        top: elementTop,
                        left: 0,
                        behavior: 'auto'
                    });
                    document.documentElement.scrollTop = elementTop;
                    document.body.scrollTop = elementTop;
                    if (document.scrollingElement) {
                        (document.scrollingElement as HTMLElement).scrollTop = elementTop;
                    }
                    
                    // Also try scrollIntoView
                    element.scrollIntoView({ 
                        block: 'start', 
                        inline: 'nearest',
                        behavior: 'auto'
                    });
                }
            };
            
            // Try multiple times with increasing delays to catch it after render
            scrollToPostDetails();
            const timeouts = [
                setTimeout(scrollToPostDetails, 0),
                setTimeout(scrollToPostDetails, 10),
                setTimeout(scrollToPostDetails, 50),
                setTimeout(scrollToPostDetails, 100),
                setTimeout(scrollToPostDetails, 200),
                setTimeout(scrollToPostDetails, 300),
                setTimeout(scrollToPostDetails, 500),
                setTimeout(scrollToPostDetails, 800)
            ];
            
            return () => {
                timeouts.forEach(clearTimeout);
            };
        } else {
            // For other steps, scroll to top
            window.scrollTo(0, 0);
        }
    }, [currentStep]);
    
    // Ref callback to scroll immediately when element is rendered
    const postDetailsRefCallback = React.useCallback((node: HTMLDivElement | null) => {
        (postDetailsRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (node && currentStep === 'details') {
            // Scroll immediately when element is rendered - use multiple methods
            const scrollIt = () => {
                const y = node.offsetTop;
                window.scrollTo(0, y);
                document.documentElement.scrollTop = y;
                document.body.scrollTop = y;
                node.scrollIntoView({ block: 'start', behavior: 'auto' });
            };
            
            // Try immediately and with delays
            scrollIt();
            setTimeout(scrollIt, 0);
            setTimeout(scrollIt, 50);
            setTimeout(scrollIt, 100);
        }
    }, [currentStep]);

    // For top templates (Gazetteer, Instagram, TikTok, YouTube Shorts), support dynamic clips
    const isTopTemplate = template?.id === TEMPLATE_IDS.INSTAGRAM || template?.id === TEMPLATE_IDS.TIKTOK || template?.id === TEMPLATE_IDS.GAZETTEER || template?.id === TEMPLATE_IDS.YOUTUBE_SHORTS;
    const isCarouselTemplate = template?.id === TEMPLATE_IDS.GAZETTEER;
    // Get max clips based on template: Gazetteer = 10, others = 1
    const getMaxClips = () => isCarouselTemplate ? MAX_CLIPS_CAROUSEL : MAX_CLIPS;
    const [dynamicClips, setDynamicClips] = React.useState<Array<{ id: string; mediaType: 'image' | 'video' | 'text'; duration: number }>>(
        isTopTemplate ? [{ id: 'clip-1', mediaType: 'video', duration: DEFAULT_CLIP_DURATION }] : []
    );

    // Use dynamic clips for top templates, otherwise use template.clips
    const activeClips = isTopTemplate ? dynamicClips : (template?.clips || []);

    // Scroll on route change
    React.useEffect(() => {
        // Disable scroll restoration
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        
        // Always scroll to top first when route changes - use multiple methods
        const scrollToTop = () => {
            window.scrollTo(0, 0);
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            if (document.scrollingElement) {
                (document.scrollingElement as HTMLElement).scrollTop = 0;
            }
            const mainElement = document.getElementById('main');
            if (mainElement) {
                mainElement.scrollTop = 0;
            }
        };
        
        // Scroll immediately and with delays
        scrollToTop();
        setTimeout(scrollToTop, 0);
        setTimeout(scrollToTop, 10);
        setTimeout(scrollToTop, 50);
        
        // If on details step, also scroll to Post Details after a delay
        if (currentStep === 'details') {
            setTimeout(() => {
                const element = document.getElementById('post-details-section');
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const elementTop = rect.top + scrollTop;
                    window.scrollTo(0, elementTop);
                    element.scrollIntoView({ block: 'start', behavior: 'auto' });
                }
            }, 200);
        }
    }, [location.pathname, currentStep]);

    // Force scroll to top of Post Details section
    React.useEffect(() => {
        if (currentStep === 'details') {
            const scrollToPostDetails = () => {
                const element = document.getElementById('post-details-section');
                if (element) {
                    // Get the bounding rect to see where it actually is
                    const rect = element.getBoundingClientRect();
                    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                    const elementTop = rect.top + currentScroll;
                    
                    // Account for any sticky headers (if header is ~56px, subtract it)
                    // But actually, we want the element at the very top, so use elementTop directly
                    const targetScroll = elementTop;
                    
                    // Force scroll - use instant behavior
                    window.scrollTo({
                        top: targetScroll,
                        left: 0,
                        behavior: 'auto'
                    });
                    
                    // Also set directly on all possible scroll containers
                    document.documentElement.scrollTop = targetScroll;
                    document.body.scrollTop = targetScroll;
                    if (document.scrollingElement) {
                        (document.scrollingElement as HTMLElement).scrollTop = targetScroll;
                    }
                    
                    // Use scrollIntoView as well to ensure it's at the top
                    element.scrollIntoView({ 
                        block: 'start', 
                        inline: 'nearest',
                        behavior: 'auto'
                    });
                    
                    // Verify the scroll worked and force again if needed
                    setTimeout(() => {
                        const finalRect = element.getBoundingClientRect();
                        // If element is not at top of viewport (within 5px tolerance), force scroll again
                        if (finalRect.top > 5) {
                            window.scrollTo(0, targetScroll);
                            element.scrollIntoView({ block: 'start', behavior: 'auto' });
                        }
                    }, 50);
                }
            };
            
            // First scroll to top to reset
            window.scrollTo(0, 0);
            
            // Then scroll to Post Details with multiple attempts
            scrollToPostDetails();
            const timeouts = [
                setTimeout(scrollToPostDetails, 10),
                setTimeout(scrollToPostDetails, 50),
                setTimeout(scrollToPostDetails, 100),
                setTimeout(scrollToPostDetails, 200),
                setTimeout(scrollToPostDetails, 400)
            ];
            
            return () => {
                timeouts.forEach(clearTimeout);
            };
        }
    }, [currentStep]);

    React.useEffect(() => {
        // Only redirect if we've checked sessionStorage and still don't have a template
        const checkTemplate = () => {
            if (!template) {
                const savedState = sessionStorage.getItem('templateEditorState');
                if (savedState) {
                    try {
                        const state = JSON.parse(savedState);
                        if (state.template) {
                            // Template found in sessionStorage, set it
                            setTemplate(state.template);
                            return; // Don't redirect, template is being restored
                        }
                    } catch (e) {
                        // Error parsing, continue to redirect
                    }
                }
                // No template found, redirect to templates page
                navigate('/templates');
            }
        };
        
        // Small delay to allow sessionStorage restoration to complete
        const timeoutId = setTimeout(checkTemplate, 100);
        return () => clearTimeout(timeoutId);
    }, [template, navigate]);


    if (!template) {
        return null;
    }

    const currentClip = activeClips[currentClipIndex] || activeClips[0];
    
    // Count only filled clips (clips with media or text)
    const filledClipsCount = activeClips.filter(clip => {
        if (clip.mediaType === 'text') {
            return textOnlyClips.has(clip.id);
        }
        return userMedia.has(clip.id);
    }).length;
    
    const allClipsFilled = activeClips.length > 0 && activeClips.every(clip => {
        if (clip.mediaType === 'text') {
            return textOnlyClips.has(clip.id);
        }
        return userMedia.has(clip.id);
    });
    
    // Handle returning from text-only page with clip data
    React.useEffect(() => {
        const locationState = location.state as any;
        if (locationState?.textClipData && locationState?.clipId) {
            const { text, textStyle, clipId } = locationState.textClipData;
            
            // Restore state from sessionStorage
            const savedState = sessionStorage.getItem('templateEditorState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    
                    // Restore template if not already set
                    if (state.template && !template) {
                        setTemplate(state.template);
                    }
                    
                    // Restore all state
                    if (state.dynamicClips) {
                        setDynamicClips(state.dynamicClips);
                    }
                    if (state.userMedia) {
                        const mediaMap = new Map<string, UserMedia>();
                        state.userMedia.forEach((item: { id: string; url: string; mediaType: 'image' | 'video' }) => {
                            // Reconstruct UserMedia without File object (file will be undefined)
                            mediaMap.set(item.id, {
                                clipId: item.id,
                                url: item.url,
                                mediaType: item.mediaType
                                // file is not restored as it can't be serialized
                            });
                        });
                        setUserMedia(mediaMap);
                    }
                    if (state.textOnlyClips) {
                        const textMap = new Map();
                        state.textOnlyClips.forEach(([id, textData]: [string, any]) => {
                            textMap.set(id, textData);
                        });
                        setTextOnlyClips(textMap);
                    }
                    if (state.stickers) {
                        const stickerMap = new Map();
                        state.stickers.forEach(([id, stickerArray]: [string, StickerOverlay[]]) => {
                            stickerMap.set(id, stickerArray);
                        });
                        setStickers(stickerMap);
                    }
                    if (state.currentClipIndex !== undefined) {
                        setCurrentClipIndex(state.currentClipIndex);
                    }
                    if (state.text !== undefined) setText(state.text);
                    if (state.locationLabel !== undefined) setLocationLabel(state.locationLabel);
                    if (state.bannerText !== undefined) setBannerText(state.bannerText);
                    if (state.taggedUsers) setTaggedUsers(state.taggedUsers);
                    
                    // Add the new text clip (this will overwrite if it already exists in restored state)
                    setTextOnlyClips(prev => {
                        const newMap = new Map(prev);
                        newMap.set(clipId, { text, textStyle });
                        return newMap;
                    });
                    
                    // Clear sessionStorage
                    sessionStorage.removeItem('templateEditorState');
                } catch (e) {
                    console.error('Error restoring template editor state:', e);
                    // Fallback: just add the text clip
                    setTextOnlyClips(prev => {
                        const newMap = new Map(prev);
                        newMap.set(clipId, { text, textStyle });
                        return newMap;
                    });
                }
            } else {
                // Fallback: just add the text clip
                setTextOnlyClips(prev => {
                    const newMap = new Map(prev);
                    newMap.set(clipId, { text, textStyle });
                    return newMap;
                });
            }
            
            // Clear the state to prevent re-processing
            window.history.replaceState({ ...window.history.state, state: null }, '');
        }
    }, [location.state, template]);

    // Get gradient style for button text based on template
    const buttonTextStyle = React.useMemo((): React.CSSProperties => {
        if (template?.id === TEMPLATE_IDS.INSTAGRAM) {
            return {
                background: TEMPLATE_GRADIENTS.INSTAGRAM,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        } else if (template?.id === TEMPLATE_IDS.TIKTOK) {
            return {
                background: TEMPLATE_GRADIENTS.TIKTOK,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        } else if (template?.id === TEMPLATE_IDS.GAZETTEER) {
            return {
                background: TEMPLATE_GRADIENTS.GAZETTEER,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        } else if (template?.id === TEMPLATE_IDS.YOUTUBE_SHORTS) {
            return {
                background: TEMPLATE_GRADIENTS.YOUTUBE_SHORTS,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`,
                display: 'block'
            };
        }
        return { color: 'white', display: 'block' };
    }, [template?.id]);
    const showPinnedNext = currentStep === 'media' && userMedia.size > 0;
    const canGoPrevious = currentClipIndex > 0;
    const canGoNext = currentClipIndex < activeClips.length - 1;

    // Auto-advance to details step when all clips are filled
    React.useEffect(() => {
        if (allClipsFilled && currentStep === 'media') {
            // Don't auto-advance, let user click Next
        }
    }, [allClipsFilled, currentStep]);

    // Get platform type from template
    const getPlatformType = (): PlatformType | null => {
        if (template?.id === TEMPLATE_IDS.TIKTOK) return 'tiktok';
        if (template?.id === TEMPLATE_IDS.INSTAGRAM) return 'instagram';
        if (template?.id === TEMPLATE_IDS.YOUTUBE_SHORTS) return 'youtube-shorts';
        return null;
    };

    // Handle platform-specific file selection
    async function handlePlatformFileSelect(clipId: string) {
        const platformType = getPlatformType();
        if (!platformType) {
            // Fallback to regular file input for non-platform templates
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = isTopTemplate ? 'image/*,video/mp4,.mp4' : (activeClips.find(c => c.id === clipId)?.mediaType === 'video' ? 'video/mp4,.mp4' : 'image/*');
            input.onchange = (e) => handleMediaSelect(clipId, e as any);
            input.click();
            return;
        }

        try {
            if (isWeb()) {
                // Web: Use custom file picker with filtering
                const files = await pickFiles(platformType);
                if (files.length === 0) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Gazetteer says',
                        html: `<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">No files selected</p><p style="margin: 0;">Please select a video or image file.</p>`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                    return;
                }
                
                // Use the first file
                const file = files[0] as File;
                const fakeEvent = {
                    target: { files: [file] }
                };
                handleMediaSelect(clipId, fakeEvent as unknown as React.ChangeEvent<HTMLInputElement>);
            } else {
                // React Native: Use native picker
                const results = await pickFiles(platformType);
                if (results.length === 0) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Gazetteer says',
                        html: `<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">No files selected</p><p style="margin: 0;">Please select a video or image file.</p>`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                    return;
                }
                
                // Process the first result (React Native format from react-native-image-crop-picker)
                const result = results[0];
                // react-native-image-crop-picker returns: { path, mime, size, width, height, duration, etc. }
                const mediaType = result.mime?.startsWith('image/') ? 'image' : 'video';
                const url = result.path || result.uri;
                
                if (!url) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Could not access file path.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    return;
                }

                // For React Native, we use the path/uri directly
                // The media will be loaded from the path
                setUserMedia(prev => {
                    const newMap = new Map(prev);
                    newMap.set(clipId, {
                        clipId,
                        url: url, // Use path/uri for React Native
                        mediaType,
                        file: undefined // No File object in React Native
                    });
                    return newMap;
                });

                // Update clip mediaType if needed
                if (isTopTemplate) {
                    const clipIndex = dynamicClips.findIndex(c => c.id === clipId);
                    if (clipIndex !== -1) {
                        setDynamicClips(prev => {
                            const newClips = [...prev];
                            newClips[clipIndex] = { ...newClips[clipIndex], mediaType };
                            return newClips;
                        });
                    }
                }

                // Auto-advance to next clip if available
                const currentIndex = activeClips.findIndex(c => c.id === clipId);
                if (currentIndex < activeClips.length - 1) {
                    setTimeout(() => {
                        setCurrentClipIndex(currentIndex + 1);
                    }, 300);
                }
            }
        } catch (error) {
            console.error('Error selecting platform files:', error);
            Swal.fire({
                icon: 'error',
                title: 'Gazetteer says',
                html: `<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">Error</p><p style="margin: 0;">Failed to select files. Please try again.</p>`,
                timer: 2000,
                showConfirmButton: false
            });
        }
    }

    function handleMediaSelect(clipId: string, event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        // For platform templates, check if file matches platform (but allow all videos/images as fallback)
        const platformType = getPlatformType();
        if (platformType && isWeb()) {
            const filtered = filterFilesByPlatform([file], platformType);
            // Only warn if it's not a video/image at all, otherwise allow it
            const isVideoOrImage = file.type.startsWith('video/') || file.type.startsWith('image/');
            if (!isVideoOrImage) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid file type',
                    text: 'Please select a video or image file.',
                    timer: 3000,
                    showConfirmButton: false
                });
                return;
            }
            // Allow the file even if it doesn't match platform patterns (filtering is now lenient)
        }

        // Validate MP4 for video templates (but top templates accept both images and videos)
        if (!isTopTemplate) {
            const currentClip = activeClips.find(c => c.id === clipId);
            if (currentClip?.mediaType === 'video') {
                if (!file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
                    alert('Please select an MP4 video file only.');
                    return;
                }
            }
        } else {
            // For top templates, validate video is MP4 if it's a video file
            if (file.type.startsWith('video/') && !file.type.includes('mp4') && !file.name.toLowerCase().endsWith('.mp4')) {
                alert('Please select an MP4 video file or an image.');
                return;
            }
        }

        const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

        // Use URL.createObjectURL for videos (better Edge support) and FileReader for images
        if (mediaType === 'video') {
            // Use createObjectURL for videos - better performance and Edge compatibility
            const url = URL.createObjectURL(file);

            // For top templates, update the clip's mediaType based on what was selected
            if (isTopTemplate) {
                const clipIndex = dynamicClips.findIndex(c => c.id === clipId);
                if (clipIndex !== -1) {
                    setDynamicClips(prev => {
                        const newClips = [...prev];
                        newClips[clipIndex] = { ...newClips[clipIndex], mediaType };
                        return newClips;
                    });
                }
            }

            setUserMedia(prev => {
                const newMap = new Map(prev);
                newMap.set(clipId, {
                    clipId,
                    url,
                    mediaType,
                    file
                });
                return newMap;
            });

            // Auto-advance to next clip if available (only if not at max)
            const currentIndex = activeClips.findIndex(c => c.id === clipId);
            if (currentIndex < activeClips.length - 1) {
                setTimeout(() => {
                    setCurrentClipIndex(currentIndex + 1);
                }, 300);
            }
        } else {
            // Use FileReader for images
            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target?.result as string;

                setUserMedia(prev => {
                    const newMap = new Map(prev);
                    newMap.set(clipId, {
                        clipId,
                        url,
                        mediaType,
                        file
                    });
                    return newMap;
                });

                // Auto-advance to next clip if available (only if not at max)
                const currentIndex = activeClips.findIndex(c => c.id === clipId);
                if (currentIndex < activeClips.length - 1) {
                    setTimeout(() => {
                        setCurrentClipIndex(currentIndex + 1);
                    }, 300);
                }
            };
            reader.readAsDataURL(file);
        }
    }

    function handleNext() {
        if (currentClipIndex < activeClips.length - 1) {
            setCurrentClipIndex(currentClipIndex + 1);
        }
    }

    function handlePrevious() {
        if (currentClipIndex > 0) {
            setCurrentClipIndex(currentClipIndex - 1);
        }
    }

    function handleRemoveMedia(clipId: string) {
        setUserMedia(prev => {
            const newMap = new Map(prev);
            newMap.delete(clipId);
            return newMap;
        });
    }

    function handleAddClip() {
        if (!isTopTemplate || isAddingClipRef.current) return;
        
        const maxClips = getMaxClips();
        // Check if we're at max clips
        if (dynamicClips.length >= maxClips) return;
        
        // Set flag to prevent multiple rapid clicks
        isAddingClipRef.current = true;
        
        // Use functional update to prevent race conditions
        setDynamicClips(prev => {
            if (prev.length >= maxClips) {
                isAddingClipRef.current = false;
                return prev; // Don't add if at max
            }
            
            // Generate a unique clip ID that doesn't conflict with text-clip IDs
            // Find the highest numbered clip ID to avoid conflicts
            const existingClipNumbers = prev
                .map(clip => {
                    const match = clip.id.match(/^clip-(\d+)$/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(num => num > 0);
            const nextClipNumber = existingClipNumbers.length > 0 
                ? Math.max(...existingClipNumbers) + 1 
                : prev.length + 1;
            
            const newClipId = `clip-${nextClipNumber}`;
            const newClip = {
                id: newClipId,
                mediaType: 'video' as const,
                duration: DEFAULT_CLIP_DURATION
            };
            
            // Navigate to the new clip after state update
            setTimeout(() => {
                setCurrentClipIndex(prev.length); // Navigate to the new clip (index is prev.length before adding)
                isAddingClipRef.current = false; // Reset flag after state update
            }, 100);
            
            return [...prev, newClip];
        });
    }

    // Removed unused function - clips are managed via dynamic state
    // function handleRemoveClip(clipId: string) {
    //     if (!isTopTemplate || dynamicClips.length <= 1) return;
    //     
    //     const index = dynamicClips.findIndex(c => c.id === clipId);
    //     if (index === -1) return;
    //     
    //     // Remove media and stickers for this clip
    //     setUserMedia(prev => {
    //         const newMap = new Map(prev);
    //         newMap.delete(clipId);
    //         return newMap;
    //     });
    //     setStickers(prev => {
    //         const newMap = new Map(prev);
    //         newMap.delete(clipId);
    //         return newMap;
    //     });
    //     
    //     // Remove the clip
    //     const newClips = dynamicClips.filter(c => c.id !== clipId);
    //     setDynamicClips(newClips);
    //     
    //     // Adjust current index if needed
    //     if (currentClipIndex >= newClips.length) {
    //         setCurrentClipIndex(newClips.length - 1);
    //     }
    // }

    async function handleCreateVideo() {
        // Allow creating post with at least one clip filled
        const filledClips = activeClips.filter(clip => userMedia.has(clip.id));
        if (filledClips.length === 0 || !user) return;

        setIsProcessing(true);
        try {
            // Increment template usage
            await incrementTemplateUsage(template?.id || '');

            // Check if we have at least one filled clip (either media or text-only)
            const hasAnyFilledClip = activeClips.some(clip => {
                if (clip.mediaType === 'text') {
                    return textOnlyClips.has(clip.id);
                }
                return userMedia.has(clip.id);
            });
            if (!hasAnyFilledClip) return;
            
            // Get first media for backward compatibility (skip text-only clips)
            const firstMedia = Array.from(userMedia.values())[0];

            // Collect media items from clips that have been filled, including text-only clips
            const allMediaItems: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: any[]; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }> = [];
            
            activeClips.forEach(clip => {
                if (clip.mediaType === 'text') {
                    // Handle text-only clips
                    const textClip = textOnlyClips.get(clip.id);
                    if (textClip) {
                        // Use a special data URL to mark this as a text-only clip
                        allMediaItems.push({
                            url: `data:text/plain;base64,${btoa(textClip.text)}`, // Encode text as base64 in data URL
                            type: 'text',
                            duration: clip.duration,
                            text: textClip.text,
                            textStyle: textClip.textStyle || { color: '#ffffff', size: 'medium', background: '#000000' }
                        });
                    }
                } else {
                    // Handle regular media clips
                    const media = userMedia.get(clip.id);
                    if (media) {
                        // Get effects from template clip if it exists, otherwise empty array
                        const clipEffects: any[] = 'effects' in clip && Array.isArray(clip.effects) ? clip.effects : [];
                        allMediaItems.push({
                            url: media.url,
                            type: media.mediaType,
                            duration: clip.duration,
                            effects: clipEffects
                        });
                    }
                }
            });

            // Combine stickers from all clips
            const allStickers: StickerOverlay[] = [];
            activeClips.forEach(clip => {
                const clipStickers = stickers.get(clip.id) || [];
                allStickers.push(...clipStickers);
            });

            // Create post with all clips' media as a carousel
            const taggedUsersToPass = taggedUsers && Array.isArray(taggedUsers) && taggedUsers.length > 0 ? taggedUsers : undefined;

            // Find first non-text item for backward compatibility (mediaUrl/mediaType)
            const firstMediaItem = allMediaItems.find(item => item.type !== 'text');
            
            await createPost(
                user.id,
                user.handle,
                text.trim(),
                locationLabel.trim(),
                firstMediaItem?.url, // First non-text media for backward compatibility
                firstMediaItem?.type === 'text' ? undefined : (firstMediaItem?.type as 'image' | 'video' | undefined), // First media type for backward compatibility (skip text)
                undefined, // imageText
                text.trim() || undefined, // caption
                user.local,
                user.regional,
                user.national,
                allStickers.length > 0 ? allStickers : undefined, // Pass all stickers
                template?.id || undefined, // templateId
                allMediaItems.filter(item => item !== null) as Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>, // Pass all media items for carousel (including text-only clips)
                bannerText.trim() || undefined, // bannerText
                undefined, // textStyle
                taggedUsersToPass, // taggedUsers
                captionsEnabled, // videoCaptionsEnabled
                videoCaptionText.trim() || undefined, // videoCaptionText
                subtitlesEnabled, // subtitlesEnabled
                subtitleText.trim() || undefined // subtitleText
            );

            // Dispatch event to refresh feed
            window.dispatchEvent(new CustomEvent('postCreated'));

            // Navigate back to feed
            navigate('/feed');
        } catch (error) {
            console.error('Error creating video from template:', error);
            alert('Failed to create video. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    }

    const currentMedia = currentClip ? (currentClip.mediaType === 'text' ? null : userMedia.get(currentClip.id)) : null;
    const currentTextOnlyClip = currentClip && currentClip.mediaType === 'text' ? textOnlyClips.get(currentClip.id) : null;
    const currentStickers = currentClip ? stickers.get(currentClip.id) || [] : [];
    
    // Calculate progress based on filled clips, but use current position in all clips
    const progress = filledClipsCount > 0 ? ((currentClipIndex + 1) / Math.max(activeClips.length, filledClipsCount)) * 100 : 0;
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

    // Cleanup object URLs when component unmounts or media changes
    React.useEffect(() => {
        return () => {
            // Cleanup all object URLs to prevent memory leaks
            userMedia.forEach(media => {
                if (media.url && media.url.startsWith('blob:')) {
                    URL.revokeObjectURL(media.url);
                }
            });
        };
    }, []);

    React.useEffect(() => {
        if (mediaContainerRef.current) {
            const updateSize = () => {
                const rect = mediaContainerRef.current?.getBoundingClientRect();
                if (rect) {
                    setContainerSize({ width: rect.width, height: rect.height });
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, [currentMedia]);

    function handleSelectSticker(sticker: Sticker) {
        if (!currentClip) return;

        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: sticker.id,
            sticker,
            x: 50, // Center position
            y: 50,
            scale: 1,
            rotation: 0,
            opacity: 1
        };

        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(currentClip.id) || [];
            newMap.set(currentClip.id, [...clipStickers, newOverlay]);
            return newMap;
        });

        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleAddTextSticker(text: string, fontSize: 'small' | 'medium' | 'large', color: string) {
        if (!currentClip) return;

        // Create a text sticker
        const textSticker: Sticker = {
            id: `text-sticker-${Date.now()}`,
            name: text,
            category: 'Text',
            emoji: undefined,
            url: undefined,
            isTrending: false
        };

        const newOverlay: StickerOverlay = {
            id: `sticker-${Date.now()}-${Math.random()}`,
            stickerId: textSticker.id,
            sticker: {
                ...textSticker,
                // Store custom properties in the sticker name for now
                // In production, you'd have a proper text property
            },
            x: 50,
            y: 50,
            scale: fontSize === 'small' ? 0.8 : fontSize === 'medium' ? 1 : 1.2,
            rotation: 0,
            opacity: 1
        };

        // Store text and color in a way we can access it
        // We'll use a custom property approach
        (newOverlay as any).textContent = text;
        (newOverlay as any).textColor = color;
        (newOverlay as any).fontSize = fontSize;

        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(currentClip.id) || [];
            newMap.set(currentClip.id, [...clipStickers, newOverlay]);
            return newMap;
        });

        setSelectedStickerOverlay(newOverlay.id);
    }

    function handleUpdateSticker(clipId: string, overlayId: string, updated: StickerOverlay) {
        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(clipId) || [];
            const index = clipStickers.findIndex(s => s.id === overlayId);
            if (index !== -1) {
                clipStickers[index] = updated;
                newMap.set(clipId, [...clipStickers]);
            }
            return newMap;
        });
    }

    function handleRemoveSticker(clipId: string, overlayId: string) {
        setStickers(prev => {
            const newMap = new Map(prev);
            const clipStickers = newMap.get(clipId) || [];
            newMap.set(clipId, clipStickers.filter(s => s.id !== overlayId));
            return newMap;
        });
        if (selectedStickerOverlay === overlayId) {
            setSelectedStickerOverlay(null);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white" style={{ marginTop: '-1rem', paddingTop: 0 }}>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-gray-800">
                <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
                        aria-label="Back"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex-1 mx-4">
                        {currentStep === 'media' ? (
                            <>
                                <div className="text-sm text-gray-400 mb-1">
                                    Clip {currentClipIndex + 1} of {filledClipsCount} {isTopTemplate && `(Max ${getMaxClips()})`}
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-sm font-medium text-white">
                                Post Details
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                </div>
            </div>

            {showPinnedNext && (
                <div className="fixed bottom-0 left-0 right-0 z-40">
                    <div className="mx-auto max-w-md px-4 pt-3 pb-4">
                        <div className="rounded-xl bg-black/85 backdrop-blur border border-white/10 p-2 shadow-lg">
                            <div className="flex items-center gap-2">
                                {/* Add Another Clip Button - Left */}
                                {isTopTemplate && activeClips.length < getMaxClips() && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const maxClips = getMaxClips();
                                            if (activeClips.length < maxClips && !isAddingClipRef.current) {
                                                handleAddClip();
                                            }
                                        }}
                                        disabled={activeClips.length >= getMaxClips() || isAddingClipRef.current}
                                        className="flex-1 py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiPlus className="w-1.5 h-1.5" />
                                        <span style={buttonTextStyle} className="text-sm">Add Another Clip ({filledClipsCount}/{getMaxClips()})</span>
                                    </button>
                                )}

                                {/* Next Button - Right */}
                                <button
                                    onClick={() => {
                                        setCurrentStep('details');
                                    }}
                                    className={`py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5 ${isTopTemplate && activeClips.length < getMaxClips() ? 'px-4' : 'w-full'}`}
                                >
                                    <span style={buttonTextStyle} className="text-sm">Next</span>
                                    <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Post Now Button - Pinned Footer (Details Step Only) */}
            {currentStep === 'details' && (
                <div className="fixed bottom-0 left-0 right-0 z-40">
                    <div className="mx-auto max-w-md px-4 pt-3 pb-4">
                        <div className="rounded-xl bg-black/85 backdrop-blur border border-white/10 p-2 shadow-lg">
                            <button
                                onClick={handleCreateVideo}
                                disabled={userMedia.size === 0 || isProcessing}
                                className="w-full py-2.5 bg-black text-white border border-white/40 rounded-lg text-sm font-semibold hover:bg-black/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm">Creating...</span>
                                    </>
                                ) : (
                                    <>
                                        <span style={buttonTextStyle} className="text-sm">Post Now</span>
                                        <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`max-w-md mx-auto px-4 pt-20 pb-4 ${showPinnedNext || currentStep === 'details' ? 'pb-40' : 'pb-24'}`}>
                {currentStep === 'media' ? (
                    <>
                        {/* Step 1: Add Media */}
                        {/* Current Clip Preview - Clean and Simple */}
                        <div className="mb-6">
                            {(currentMedia || currentTextOnlyClip) ? (
                                <div className="flex items-center justify-center gap-4">
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handlePrevious}
                                            disabled={!canGoPrevious}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoPrevious ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronLeft className="w-5 h-5 text-white" />
                                            <span className="sr-only">Previous clip</span>
                                        </button>
                                    )}
                                    <div
                                        ref={mediaContainerRef}
                                        className="relative aspect-[9/16] max-h-[55vh] rounded-2xl overflow-hidden bg-gray-900 mx-auto shadow-lg"
                                        style={{
                                            aspectRatio: '9/16',
                                            maxHeight: '55vh',
                                            width: '100%',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onClick={(e) => {
                                            // Deselect sticker when clicking on media
                                            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).tagName === 'IMG') {
                                                setSelectedStickerOverlay(null);
                                            }
                                        }}
                                    >
                                        {/* Display text-only clip in Twitter card format */}
                                        {currentTextOnlyClip ? (
                                            <div className="w-full h-full flex items-center justify-center p-4 bg-black">
                                                <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-2xl" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                    {/* Post Header */}
                                                    <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-gray-600 text-sm font-semibold">
                                                                    {user?.handle?.split('@')[0]?.charAt(0).toUpperCase() || 'U'}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <h3 className="font-semibold flex items-center gap-1.5 text-gray-900 text-sm">
                                                                    <span>{user?.handle || 'User'}</span>
                                                                </h3>
                                                                <div className="text-xs text-gray-600 flex items-center gap-2 mt-0.5">
                                                                    {locationLabel && (
                                                                        <>
                                                                            <span className="flex items-center gap-1">
                                                                                <FiMapPin className="w-3 h-3" />
                                                                                {locationLabel}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Text Content - Twitter card style (white card with black text box) */}
                                                    <div className="p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                        <div className="p-4 rounded-lg bg-black overflow-hidden w-full" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                                                            <div className="text-base leading-relaxed whitespace-pre-wrap font-normal text-white break-words w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
                                                                {currentTextOnlyClip.text}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : currentMedia ? (
                                        /* Apply effects from template clip */
                                        (() => {
                                            // Get effects from template clip if it exists, otherwise empty array
                                            const clipEffects: any[] = 'effects' in currentClip && Array.isArray(currentClip.effects) ? currentClip.effects : [];

                                            let mediaElement: React.ReactNode = currentMedia.mediaType === 'video' ? (
                                                <video
                                                    src={currentMedia.url}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    style={{
                                                        objectFit: 'cover',
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'block',
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={currentMedia.url}
                                                    alt={`Clip ${currentClipIndex + 1}`}
                                                    className="w-full h-full object-cover"
                                                    style={{
                                                        objectFit: 'cover',
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'block',
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0
                                                    }}
                                                />
                                            );

                                            // Apply effects in reverse order (last effect wraps everything)
                                            clipEffects.forEach((effect: EffectConfig) => {
                                                mediaElement = (
                                                    <EffectWrapper key={effect.type} effect={effect} isActive={true}>
                                                        {mediaElement}
                                                    </EffectWrapper>
                                                );
                                            });

                                            return mediaElement;
                                        })()
                                        ) : null}

                                        {/* Show active effects indicator */}
                                        {(() => {
                                            const hasEffects = 'effects' in (currentClip || {}) && currentClip && 'effects' in currentClip && Array.isArray(currentClip.effects) && currentClip.effects.length > 0;
                                            return hasEffects ? (
                                                <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1">
                                                    {Array.isArray(currentClip.effects) && currentClip.effects.map((effect: EffectConfig, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-full"
                                                            title={`${effect.type}${effect.colorGrading ? ` - ${effect.colorGrading}` : ''}`}
                                                        >
                                                            {effect.type === 'color-grading' && effect.colorGrading ? (
                                                                <span className="capitalize">{effect.colorGrading.replace('-', ' ')}</span>
                                                            ) : (
                                                                <span className="capitalize">{effect.type.replace('-', ' ')}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Sticker Overlays */}
                                        {currentStickers.map((overlay) => (
                                            <StickerOverlayComponent
                                                key={overlay.id}
                                                overlay={overlay}
                                                onUpdate={(updated) => handleUpdateSticker(currentClip?.id || '', overlay.id, updated)}
                                                onRemove={() => handleRemoveSticker(currentClip?.id || '', overlay.id)}
                                                isSelected={selectedStickerOverlay === overlay.id}
                                                onSelect={() => setSelectedStickerOverlay(overlay.id)}
                                                containerWidth={containerSize.width || 400}
                                                containerHeight={containerSize.height || 711}
                                            />
                                        ))}

                                        <button
                                            onClick={() => handleRemoveMedia(currentClip?.id || '')}
                                            className="absolute top-3 right-3 p-2 bg-black/70 backdrop-blur-sm text-white rounded-full hover:bg-black/90 transition-colors z-10"
                                        >
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {activeClips.length > 1 && (
                                        <button
                                            onClick={handleNext}
                                            disabled={!canGoNext}
                                            className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <FiChevronRight className="w-5 h-5 text-white" />
                                            <span className="sr-only">Next clip</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Photo/Video Option */}
                                    <div className="flex items-center justify-center gap-4">
                                        {activeClips.length > 1 && (
                                            <button
                                                onClick={handlePrevious}
                                                disabled={!canGoPrevious}
                                                className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoPrevious ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                <FiChevronLeft className="w-5 h-5 text-white" />
                                                <span className="sr-only">Previous clip</span>
                                            </button>
                                        )}
                                        <label 
                                            className={`block aspect-[9/16] max-h-[55vh] rounded-2xl cursor-pointer mx-auto bg-gray-900/30 transition-colors ${template.id === TEMPLATE_IDS.INSTAGRAM
                                                ? 'ig-animated-border'
                                                : template.id === TEMPLATE_IDS.TIKTOK
                                                    ? 'tt-animated-border'
                                                    : template.id === TEMPLATE_IDS.GAZETTEER
                                                        ? 'gz-animated-border'
                                                        : template.id === TEMPLATE_IDS.YOUTUBE_SHORTS
                                                            ? 'border-2 border-red-500/50'
                                                            : 'border-2 border-dashed border-gray-700 hover:border-gray-600'
                                                }`}
                                            onClick={!isWeb() ? () => {
                                                const platformType = getPlatformType();
                                                if (platformType) {
                                                    handlePlatformFileSelect(currentClip?.id || '');
                                                }
                                            } : undefined}
                                        >
                                            {isWeb() ? (
                                                <input
                                                    type="file"
                                                    accept={isTopTemplate ? 'image/*,video/mp4,.mp4' : (currentClip?.mediaType === 'video' ? 'video/mp4,.mp4' : 'image/*')}
                                                    onChange={(e) => {
                                                        // For platform templates, filter by filename
                                                        const platformType = getPlatformType();
                                                        if (platformType) {
                                                            const files = Array.from(e.target.files || []);
                                                            const filtered = filterFilesByPlatform(files, platformType);
                                                            if (filtered.length === 0) {
                                                                Swal.fire({
                                                                    icon: 'warning',
                                                                    title: 'Gazetteer says',
                                                                    html: `<p style="font-weight: 600; font-size: 1.1em; margin: 0 0 8px 0;">No matching files</p><p style="margin: 0;">No ${platformType === 'tiktok' ? 'TikTok' : platformType === 'instagram' ? 'Instagram' : 'YouTube Shorts'} videos found. Please select files with matching filenames.</p>`,
                                                                    timer: 3000,
                                                                    showConfirmButton: false
                                                                });
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            // Use first filtered file
                                                            const fakeEvent = {
                                                                target: { files: [filtered[0]] }
                                                            } as unknown as React.ChangeEvent<HTMLInputElement>;
                                                            handleMediaSelect(currentClip?.id || '', fakeEvent);
                                                        } else {
                                                            handleMediaSelect(currentClip?.id || '', e);
                                                        }
                                                    }}
                                                    className="hidden"
                                                />
                                            ) : null}
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                                {isTopTemplate ? (
                                                    <>
                                                        <FiImage className="w-12 h-12 text-gray-500 mb-4" />
                                                        <div className="text-white text-lg font-semibold mb-2">
                                                            {template?.id === TEMPLATE_IDS.TIKTOK
                                                                ? 'Add a TikTok video to your location newsfeed'
                                                                : template?.id === TEMPLATE_IDS.INSTAGRAM
                                                                    ? 'Add an Instagram video to your location newsfeed'
                                                                    : template?.id === TEMPLATE_IDS.YOUTUBE_SHORTS
                                                                        ? 'Add a YouTube Shorts video to your location newsfeed'
                                                                        : 'Add Photo or Video'
                                                            }
                                                        </div>
                                                        <div className="text-gray-400 text-sm">
                                                            {template?.id === TEMPLATE_IDS.TIKTOK
                                                                ? 'Tap to select your TikTok video'
                                                                : template?.id === TEMPLATE_IDS.INSTAGRAM
                                                                    ? 'Tap to select your Instagram video'
                                                                    : template?.id === TEMPLATE_IDS.YOUTUBE_SHORTS
                                                                        ? 'Tap to select your YouTube Shorts video'
                                                                        : 'Tap to select image or MP4 video'
                                                            }
                                                        </div>
                                                        <div className="text-gray-500 text-xs mt-2">
                                                            {activeClips.length === 1 ? `Add ${MIN_CLIPS}-${getMaxClips()} items` : `Add up to ${getMaxClips() - activeClips.length} more`}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {currentClip?.mediaType === 'video' ? (
                                                            <FiVideo className="w-12 h-12 text-gray-500 mb-4" />
                                                        ) : (
                                                            <FiImage className="w-12 h-12 text-gray-500 mb-4" />
                                                        )}
                                                        <div className="text-white text-lg font-semibold mb-2">
                                                            Add {currentClip?.mediaType === 'video' ? 'Video (MP4 only)' : 'Photo'}
                                                        </div>
                                                        <div className="text-gray-400 text-sm">
                                                            {currentClip?.mediaType === 'video' ? 'Tap to select MP4 video' : 'Tap to select from gallery'}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </label>
                                        {activeClips.length > 1 && (
                                            <button
                                                onClick={handleNext}
                                                disabled={!canGoNext}
                                                className={`p-3 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 transition-colors ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                <FiChevronRight className="w-5 h-5 text-white" />
                                                <span className="sr-only">Next clip</span>
                                            </button>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>

                        {/* Clip Navigation - Simple Dots */}
                        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                            {activeClips.map((clip, index) => {
                                const media = userMedia.get(clip.id);
                                const textClip = clip.mediaType === 'text' ? textOnlyClips.get(clip.id) : null;
                                const isFilled = media || textClip;
                                const isCurrent = index === currentClipIndex;
                                return (
                                    <button
                                        key={clip.id}
                                        onClick={() => setCurrentClipIndex(index)}
                                        className={`w-2 h-2 rounded-full transition-all ${isCurrent
                                            ? 'bg-white w-8'
                                            : isFilled
                                                ? 'bg-gray-500'
                                                : 'bg-gray-700'
                                            }`}
                                        aria-label={`Go to clip ${index + 1}`}
                                    />
                                );
                            })}
                        </div>

                    </>
                ) : (
                    <>
                        {/* Step 3: Post Details */}
                        {/* Post Details - Simple and Clean */}
                        <div id="post-details-section" ref={postDetailsRefCallback} className="space-y-4 mb-6">
                            {/* Caption */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Caption
                                </label>
                                <div className="relative rounded-xl">
                                    {/* Outer glow animation */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                    {/* Shimmer sweep */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                        <div
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s linear infinite'
                                            }}
                                        ></div>
                                    </div>
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="Start typing"
                                        className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white resize-none text-sm"
                                        rows={3}
                                        maxLength={500}
                                    />
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1">
                                    {text.length}/500
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Location
                                </label>
                                <div className="relative rounded-xl">
                                    {/* Outer glow animation */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                                    {/* Shimmer sweep */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                        <div
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s linear infinite'
                                            }}
                                        ></div>
                                    </div>
                                    <input
                                        type="text"
                                        value={locationLabel}
                                        onChange={(e) => setLocationLabel(e.target.value)}
                                        placeholder="Where did this happen?"
                                        className="relative w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-white text-sm"
                                    />
                                </div>
                            </div>


                            {/* Tag People */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <FiUser className="w-4 h-4" />
                                    Tag People
                                </label>
                                <button
                                    onClick={() => setShowUserTagging(true)}
                                    className={`w-full p-3 rounded-xl border-2 transition-colors flex items-center justify-between text-sm ${taggedUsers.length > 0
                                        ? 'bg-brand-500/20 border-brand-500 text-white hover:bg-brand-500/30'
                                        : 'bg-gray-900 text-white border-gray-800 hover:bg-gray-800 hover:border-gray-700'
                                        }`}
                                >
                                    <span className={taggedUsers.length > 0 ? 'font-medium' : ''}>
                                        {taggedUsers.length > 0
                                            ? `${taggedUsers.length} ${taggedUsers.length === 1 ? 'person' : 'people'} tagged`
                                            : 'Tap to tag people'}
                                    </span>
                                    {taggedUsers.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            {taggedUsers.slice(0, 2).map((handle) => (
                                                <div key={handle} className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-semibold text-white">
                                                    {handle.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {taggedUsers.length > 2 && (
                                                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white">
                                                    +{taggedUsers.length - 2}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            </div>

                        </div>
                    </>
                )}
            </div>

            {/* Sticker Picker Modal */}
            <StickerPicker
                isOpen={showStickerPicker}
                onClose={() => setShowStickerPicker(false)}
                onSelectSticker={handleSelectSticker}
                onAddText={() => setShowTextStickerModal(true)}
            />

            {/* Text Sticker Modal */}
            <TextStickerModal
                isOpen={showTextStickerModal}
                onClose={() => setShowTextStickerModal(false)}
                onConfirm={(text, fontSize, color) => {
                    handleAddTextSticker(text, fontSize, color);
                    setShowTextStickerModal(false);
                }}
            />

            {/* User Tagging Modal */}
            <UserTaggingModal
                isOpen={showUserTagging}
                onClose={() => setShowUserTagging(false)}
                onSelectUser={(handle) => {
                    if (!taggedUsers.includes(handle)) {
                        const newTaggedUsers = [...taggedUsers, handle];
                        setTaggedUsers(newTaggedUsers);
                    }
                }}
                taggedUsers={taggedUsers}
            />
        </div>
    );
}

