import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { createPost } from '../api/posts';
import { saveDraft } from '../api/drafts';
import { unifiedSearch } from '../api/search';
import { showToast } from '../utils/toast';
import Avatar from '../components/Avatar';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { FiMapPin, FiX, FiSearch, FiLayers } from 'react-icons/fi';
import { TEXT_STORY_TEMPLATES, TextStoryTemplate } from '../textStoryTemplates';

export default function TextOnlyPostPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const locationState = location.state as any;
    const [text, setText] = useState<string>(locationState?.text || '');
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locationText, setLocationText] = useState<string>(locationState?.location || '');
    const [venueText, setVenueText] = useState<string>(locationState?.venue || '');
    const [taggedUsers, setTaggedUsers] = useState<string[]>(locationState?.taggedUsers || []);
    const [showLocationSheet, setShowLocationSheet] = useState(false);
    const [tagSearchQuery, setTagSearchQuery] = useState('');
    const [tagSearchUsers, setTagSearchUsers] = useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
    const [tagSearchLoading, setTagSearchLoading] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(locationState?.templateId || null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    const activeTemplate: TextStoryTemplate | undefined = selectedTemplateId
        ? TEXT_STORY_TEMPLATES.find((t) => t.id === selectedTemplateId)
        : undefined;

    const isClip = locationState?.isClip === true;

    useEffect(() => {
        if (!tagSearchQuery.trim()) {
            setTagSearchUsers([]);
            return;
        }
        const q = tagSearchQuery.trim().replace(/^@/, '');
        const t = setTimeout(async () => {
            setTagSearchLoading(true);
            try {
                const result = await unifiedSearch({ q, types: 'users', usersLimit: 20 });
                const items = result.sections?.users?.items ?? [];
                const queryLower = q.toLowerCase();
                const filtered = items.filter((u: any) => {
                    const h = (u.handle || '').toLowerCase();
                    const n = (u.display_name || u.handle || '').toLowerCase();
                    return h.includes(queryLower) || n.includes(queryLower);
                });
                setTagSearchUsers(filtered);
            } catch {
                setTagSearchUsers([]);
            } finally {
                setTagSearchLoading(false);
            }
        }, 200);
        return () => clearTimeout(t);
    }, [tagSearchQuery]);
    const clipId = locationState?.clipId;
    const templateId = locationState?.templateId;

    const handleCancel = () => {
        if (isClip) {
            navigate('/template-editor', { state: { template: { id: templateId } } });
        } else {
            navigate('/feed');
        }
    };

    const handleSaveToDrafts = async () => {
        if (!text.trim()) {
            showToast('Add some text to save a draft.');
            return;
        }
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        showToast('Saving draft...');
        try {
            await saveDraft({
                videoUrl: '',
                videoDuration: 0,
                isTextOnly: true,
                textBody: text.trim(),
                location: locationText.trim() || undefined,
                venue: venueText.trim() || undefined,
                taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
            });
            await new Promise<void>((r) => setTimeout(r, 50));
            await Swal.fire(bottomSheet({
                title: 'Saved to Drafts!',
                message: 'You can find it in your profile. Tap a draft to continue and post.',
                icon: 'success',
                confirmButtonText: 'Done',
            }));
            navigate('/feed');
        } catch (e) {
            console.error(e);
            showToast('Failed to save draft. Please try again.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleOpenLocationSheet = () => setShowLocationSheet(true);
    const addTaggedUser = (handle: string) => {
        if (!taggedUsers.includes(handle)) setTaggedUsers([...taggedUsers, handle]);
        setTagSearchQuery('');
        setTagSearchUsers([]);
    };
    const removeTaggedUser = (handle: string) => setTaggedUsers(taggedUsers.filter((h) => h !== handle));

    const handlePost = async () => {
        if (!text.trim()) return;

        if (isClip) {
            const savedState = sessionStorage.getItem('templateEditorState');
            let templateToPass = null;
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    templateToPass = state.template;
                } catch (_e) {}
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
            return;
        }

        if (!user) {
            showToast('Please log in to create a post');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedTemplate: TextStoryTemplate | undefined =
                selectedTemplateId ? TEXT_STORY_TEMPLATES.find((t) => t.id === selectedTemplateId) : undefined;

            const textStyle: { color: string; size: 'small' | 'medium' | 'large'; background: string } = selectedTemplate
                ? {
                    color: selectedTemplate.textColor,
                    size: selectedTemplate.textSize,
                    background: selectedTemplate.background,
                }
                : { color: '#ffffff', size: 'medium', background: '#000000' };

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
                selectedTemplate ? selectedTemplate.id : undefined, // templateId
                undefined, // mediaItems
                undefined, // bannerText
                textStyle, // textStyle
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
        <div className="min-h-screen bg-black flex flex-col" style={{ pointerEvents: 'auto' }}>
            {/* Header: Cancel + Template picker (left) | Location + Drafts + Post (right) */}
            <div className="sticky top-0 z-10 bg-black flex-shrink-0">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCancel}
                            className="text-white font-medium text-base hover:opacity-80 transition-opacity"
                            aria-label="Cancel"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setShowTemplatePicker(true)}
                            className={`p-1.5 rounded-full text-white transition-colors border border-white/40 ${selectedTemplateId ? 'bg-white/10' : 'hover:bg-white/10'}`}
                            aria-label="Choose template"
                        >
                            <FiLayers className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleOpenLocationSheet}
                            className="p-1.5 rounded-full text-white hover:bg-white/10 transition-colors"
                            aria-label="Add location and venue"
                        >
                            <FiMapPin className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSaveToDrafts}
                            disabled={!text.trim() || isSavingDraft}
                            className="text-white font-medium text-base hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isSavingDraft ? 'Saving...' : 'Drafts'}
                        </button>
                        <button
                            onClick={handlePost}
                            disabled={!canPost || isSubmitting}
                            className="px-5 py-2 rounded-full text-sm font-semibold border border-white text-white hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white"
                        >
                            {isSubmitting ? 'Posting...' : isClip ? 'Add to Post' : 'Post'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Profile picture + text input with template preview (postcard style) */}
            <div className="flex-1 px-4 pt-4 pb-6 overflow-y-auto">
                <div className="flex gap-3 flex-start">
                    <div className="flex-shrink-0 pt-1">
                        <Avatar
                            src={user?.avatarUrl}
                            name={user?.name || 'User'}
                            size="md"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div
                            className="rounded-2xl border border-white/10 bg-[#020617] px-3 py-2"
                            style={{
                                background: activeTemplate ? activeTemplate.background : '#020617',
                            }}
                        >
                            <textarea
                                ref={textInputRef}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="What's up?"
                                maxLength={500}
                                className="w-full bg-transparent text-[17px] leading-snug resize-none border-none outline-none min-h-[120px] py-2 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                rows={5}
                                autoFocus={!isClip}
                                style={{
                                    pointerEvents: 'auto',
                                    width: '100%',
                                    color: activeTemplate ? activeTemplate.textColor : '#ffffff',
                                    fontFamily: activeTemplate?.fontFamily || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                }}
                            />
                        </div>
                        <div className="flex justify-end mt-1">
                            <span className={`text-xs ${text.length > 450 ? (text.length >= 500 ? 'text-red-400' : 'text-amber-400') : 'text-gray-500'}`}>
                                {text.length}/500
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Location + details bottom sheet (with user search dropdown for tagging) */}
            {showLocationSheet && (
                <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowLocationSheet(false)}>
                    <div
                        className="w-full max-h-[85vh] overflow-y-auto bg-[#1a1a1a] rounded-t-2xl border-t border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-[#1a1a1a] border-b border-white/10 px-4 py-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Add details</h2>
                            <button
                                onClick={() => setShowLocationSheet(false)}
                                className="p-2 rounded-full text-white hover:bg-white/10"
                                aria-label="Close"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Location</label>
                                <input
                                    type="text"
                                    value={locationText}
                                    onChange={(e) => setLocationText(e.target.value)}
                                    placeholder="Add location"
                                    className="w-full px-3 py-2.5 rounded-lg bg-[#1f1f23] border border-gray-700 text-white text-sm outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Venue</label>
                                <input
                                    type="text"
                                    value={venueText}
                                    onChange={(e) => setVenueText(e.target.value)}
                                    placeholder="Add venue (e.g. café, stadium)"
                                    className="w-full px-3 py-2.5 rounded-lg bg-[#1f1f23] border border-gray-700 text-white text-sm outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tag people</label>
                                <div className="relative">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={tagSearchQuery}
                                        onChange={(e) => setTagSearchQuery(e.target.value)}
                                        placeholder="Search by name or handle (e.g. sarah)"
                                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#1f1f23] border border-gray-700 text-white text-sm outline-none focus:ring-2 focus:ring-white/30"
                                        autoComplete="off"
                                    />
                                    {tagSearchQuery.trim() && (
                                        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg bg-[#1f1f23] border border-gray-700 shadow-xl z-10">
                                            {tagSearchLoading ? (
                                                <div className="py-4 text-center text-gray-400 text-sm">Searching...</div>
                                            ) : tagSearchUsers.length === 0 ? (
                                                <div className="py-4 text-center text-gray-400 text-sm">No users found</div>
                                            ) : (
                                                tagSearchUsers.map((u) => {
                                                    const isTagged = taggedUsers.includes(u.handle);
                                                    return (
                                                        <button
                                                            key={u.handle}
                                                            type="button"
                                                            onClick={() => !isTagged && addTaggedUser(u.handle)}
                                                            disabled={isTagged}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${isTagged ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
                                                        >
                                                            <Avatar src={u.avatar_url} name={u.display_name || u.handle} size="sm" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white font-medium truncate">{u.display_name || u.handle}</div>
                                                                <div className="text-gray-400 text-xs truncate">@{u.handle}</div>
                                                            </div>
                                                            {isTagged && <span className="text-xs text-gray-500">Tagged</span>}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                                {taggedUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {taggedUsers.map((handle) => (
                                            <span
                                                key={handle}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white text-sm"
                                            >
                                                @{handle}
                                                <button type="button" onClick={() => removeTaggedUser(handle)} className="hover:bg-white/20 rounded-full p-0.5">
                                                    <FiX className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 pt-2 pb-6">
                            <button
                                onClick={() => setShowLocationSheet(false)}
                                className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template picker bottom sheet (reuses story text templates for feed postcards) */}
            {showTemplatePicker && (
                <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setShowTemplatePicker(false)}>
                    <div
                        className="w-full max-h-[75vh] overflow-y-auto bg-[#020617] rounded-t-2xl border-t border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-[#020617] border-b border-white/10 px-4 py-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Choose a template</h2>
                            <button
                                onClick={() => setShowTemplatePicker(false)}
                                className="p-2 rounded-full text-white hover:bg-white/10"
                                aria-label="Close template picker"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {TEXT_STORY_TEMPLATES.map((tpl) => {
                                const isSelected = selectedTemplateId === tpl.id;
                                return (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTemplateId(tpl.id);
                                            setShowTemplatePicker(false);
                                        }}
                                        className={`flex flex-col items-center gap-1 rounded-xl border px-2 pt-2 pb-2.5 transition-colors ${
                                            isSelected ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/60 hover:bg-white/5'
                                        }`}
                                    >
                                        <div
                                            className="w-full h-24 rounded-lg flex items-center justify-center text-xs font-semibold text-center px-2"
                                            style={{ background: tpl.background, color: tpl.textColor, fontFamily: tpl.fontFamily }}
                                        >
                                            Aa
                                        </div>
                                        <span className="text-xs text-white/90">{tpl.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

