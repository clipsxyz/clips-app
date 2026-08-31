import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLink } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { showToast } from '../utils/toast';
import { showUploadOverlay } from '../utils/uploadOverlay';
import PostLinkPreviewCard from '../components/PostLinkPreviewCard';
import { useLinkPreview } from '../hooks/useLinkPreview';
import { extractFirstHttpUrl, fallbackLinkPreview } from '../utils/linkPreview';
import { STORY_LINK_SHARE_CANVAS_CSS } from '../utils/discoverAmbientPalette';

export default function StoryLinkCreatePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [linkUrl, setLinkUrl] = useState('');
    const [caption, setCaption] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resolvedUrl = useMemo(
        () => extractFirstHttpUrl(linkUrl) || extractFirstHttpUrl(`https://${linkUrl.trim()}`),
        [linkUrl],
    );
    const { preview: fetchedPreview, loading } = useLinkPreview(resolvedUrl || '', { debounceMs: 0 });
    const preview = fetchedPreview || (resolvedUrl ? fallbackLinkPreview(resolvedUrl) : null);
    const canShare = Boolean(resolvedUrl) && !isSubmitting;

    const handlePaste = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            const next = (clip || '').trim();
            if (!next) {
                showToast('Copy a link first, then tap Paste.');
                return;
            }
            setLinkUrl(next);
        } catch {
            showToast('Could not read the clipboard.');
        }
    };

    const handleShare = async () => {
        if (!resolvedUrl) {
            showToast('Paste a YouTube, TikTok, Instagram, or web URL.');
            return;
        }
        if (!user) {
            showToast('Please log in to share to your story.');
            return;
        }
        const overlay = showUploadOverlay({ initialMessage: 'Posting to your story…' });
        setIsSubmitting(true);
        try {
            const note = caption.trim();
            const text = note ? `${note}\n${resolvedUrl}` : resolvedUrl;
            await createStory(
                user.id,
                user.handle,
                undefined,
                undefined,
                text,
                undefined,
                '#ffffff',
                'medium',
                undefined,
                undefined,
                { color: '#ffffff', size: 'medium', background: STORY_LINK_SHARE_CANVAS_CSS },
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                'public',
            );
            window.dispatchEvent(new CustomEvent('storyCreated', { detail: { userHandle: user.handle } }));
            overlay.success('Your story is live for 24 hours.');
            navigate('/feed');
        } catch (error: any) {
            overlay.error(error?.message || 'Could not add this link to your story.');
            showToast(error?.message || 'Share failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-black">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <button type="button" onClick={() => navigate(-1)} className="text-white text-base font-medium">
                    Cancel
                </button>
                <h1 className="text-white text-base font-bold">Add link</h1>
                <button
                    type="button"
                    onClick={() => void handleShare()}
                    disabled={!canShare}
                    className={`min-w-[72px] h-[34px] px-4 rounded-full text-sm font-bold ${
                        canShare ? 'bg-white text-gray-900' : 'bg-white/20 text-white/50'
                    }`}
                >
                    {isSubmitting ? '…' : 'Share'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
                <div
                    className="rounded-[22px] min-h-[340px] px-3.5 py-7 flex items-center justify-center"
                    style={{ background: STORY_LINK_SHARE_CANVAS_CSS }}
                >
                    {preview ? (
                        <div className="w-full">
                            <PostLinkPreviewCard preview={preview} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center px-4">
                            <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center mb-3.5">
                                <FiLink className="w-9 h-9 text-white/90" />
                            </div>
                            <p className="text-white text-xl font-bold mb-2">Share a link</p>
                            <p className="text-white/60 text-sm leading-5 max-w-xs">
                                Paste a YouTube, TikTok, Instagram, or web URL. The share card shows on your story.
                            </p>
                            {loading ? <p className="mt-4 text-white/50 text-sm">Fetching preview…</p> : null}
                        </div>
                    )}
                </div>

                <label className="block text-white/70 text-[13px] font-semibold">Link</label>
                <div className="flex items-center gap-2 rounded-[14px] border border-white/15 bg-[#0B141C] pl-3 pr-1.5 min-h-12">
                    <FiLink className="w-4 h-4 text-white/55 shrink-0" />
                    <input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://…"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoFocus
                        className="flex-1 bg-transparent text-white text-[15px] py-2.5 outline-none placeholder:text-gray-500"
                    />
                    <button
                        type="button"
                        onClick={() => void handlePaste()}
                        className="px-3 py-2 rounded-[10px] bg-[#3d9b8f]/45 text-white text-[13px] font-bold"
                    >
                        Paste
                    </button>
                </div>

                <label className="block text-white/70 text-[13px] font-semibold">Note (optional)</label>
                <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a line above the card"
                    maxLength={120}
                    className="w-full rounded-[14px] border border-white/15 bg-[#0B141C] text-white text-[15px] px-3.5 py-3 outline-none placeholder:text-gray-500"
                />
            </div>
        </div>
    );
}
