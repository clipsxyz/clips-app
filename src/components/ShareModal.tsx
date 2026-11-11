import React, { useState, useEffect } from 'react';
import { FiLink, FiMail, FiMessageCircle, FiSearch, FiCheck, FiShare2 } from 'react-icons/fi';
import { SiFacebook, SiInstagram, SiWhatsapp, SiX, SiThreads } from 'react-icons/si';
import { useAuth } from '../context/Auth';
import { showToast } from '../utils/toast';
import { updateMetaTags, clearMetaTags } from '../utils/metaTags';
import { getAvatarForHandle, resolveAvatarForUser } from '../api/users';
import { getFollowedUsers, incrementShares, regeneratePublicShareToken } from '../api/posts';
import { appendMessage } from '../api/messages';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import * as apiClient from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { buildPublicPostUrl } from '../utils/publicShare';
import Avatar from './Avatar';
import type { Post } from '../types';

const SHEET_GRADIENT = 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)';

type ShareContact = {
    handle: string;
    avatarUrl?: string;
};

type FollowingUser = {
    handle?: string;
    user_handle?: string;
    avatar_url?: unknown;
    avatarUrl?: unknown;
    avatar?: unknown;
    profile_photo?: unknown;
    image_url?: unknown;
};

function mapShareContacts(apiUsers: FollowingUser[], localHandles: string[]): ShareContact[] {
    const byHandle = new Map<string, ShareContact>();
    for (const user of apiUsers) {
        const handle = String(user?.handle ?? user?.user_handle ?? '').trim();
        if (!handle) continue;
        byHandle.set(handle.toLowerCase(), {
            handle,
            avatarUrl: resolveAvatarForUser(handle, user),
        });
    }
    for (const handle of localHandles) {
        const key = handle.toLowerCase();
        if (byHandle.has(key)) continue;
        byHandle.set(key, { handle, avatarUrl: getAvatarForHandle(handle) });
    }
    return [...byHandle.values()];
}

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
    onShareSuccess?: (postId: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post, onShareSuccess }) => {
    const [copied, setCopied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
    const [shareCaption, setShareCaption] = useState('');
    const [sending, setSending] = useState(false);
    const [followedContacts, setFollowedContacts] = useState<ShareContact[]>([]);
    const [loadingFollowed, setLoadingFollowed] = useState(false);
    const [activeShareToken, setActiveShareToken] = useState<string | undefined>(post.publicShareToken);
    const [regeneratingToken, setRegeneratingToken] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showViaMenu, setShowViaMenu] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        setActiveShareToken(post.publicShareToken);
    }, [post.id, post.publicShareToken]);

    useEffect(() => {
        if (!isOpen) setShowViaMenu(false);
    }, [isOpen]);

    const postUrl = buildPublicPostUrl(activeShareToken, post.id);
    const postTitle = post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Check out this post';
    const shareText = `${postTitle} by ${post.userHandle}`;

    // Fetch people you follow when modal opens (for "Share to DM" list)
    useEffect(() => {
        if (!isOpen || !user) return;
        setLoadingFollowed(true);
        const useLaravel = isLaravelApiEnabled();

        const setFromLocal = () => {
            getFollowedUsers(user.id)
                .then((handles) => setFollowedContacts(mapShareContacts([], handles)))
                .catch(() => setFollowedContacts([]))
                .finally(() => setLoadingFollowed(false));
        };

        const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('authToken');
        if (useLaravel && user.handle && hasToken) {
            apiClient
                .fetchFollowing(user.handle, 0, 100)
                .then((res: { items?: FollowingUser[] }) => {
                    const apiUsers = res?.items ?? [];
                    return getFollowedUsers(user.id).then((localHandles) => {
                        setFollowedContacts(mapShareContacts(apiUsers, localHandles));
                    });
                })
                .catch((err) => {
                    console.warn('Share modal: fetchFollowing failed, using local list', err);
                    setFromLocal();
                    return;
                })
                .finally(() => setLoadingFollowed(false));
        } else {
            setFromLocal();
        }
    }, [isOpen, user?.id, user?.handle]);

    // Update meta tags when modal opens for Twitter Card sharing
    useEffect(() => {
        if (isOpen) {
            const avatarUrl = getAvatarForHandle(post.userHandle);
            const imageUrl = post.mediaUrl || avatarUrl || undefined;

            updateMetaTags({
                title: `${postTitle} by ${post.userHandle}`,
                description: post.text ? post.text.substring(0, 200) : `Check out this post by ${post.userHandle}`,
                image: imageUrl,
                url: postUrl,
                type: 'article'
            });

            return () => {
                clearMetaTags();
            };
        }
    }, [isOpen, post.id, postTitle, post.text, post.userHandle, post.mediaUrl, postUrl]);

    if (!isOpen) return null;

    const recordShare = async () => {
        if (!user?.id || !post.id) return;
        try {
            await incrementShares(String(user.id), String(post.id));
            window.dispatchEvent(new CustomEvent(`shareAdded-${post.id}`));
            onShareSuccess?.(String(post.id));
        } catch (err) {
            console.warn('incrementShares failed:', err);
        }
    };

    const copyText = async (text: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {
            /* fall through to the selection copy */
        }
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.top = '0';
            area.style.left = '0';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.focus();
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            return ok;
        } catch (err) {
            console.error('Failed to copy link:', err);
            return false;
        }
    };

    const handleCopyLink = async () => {
        const ok = await copyText(postUrl);
        if (!ok) {
            showToast?.('Could not copy the link. Try again.');
            return false;
        }
        setCopied(true);
        showToast?.('Link copied!');
        setTimeout(() => setCopied(false), 2000);
        await recordShare();
        return true;
    };

    const openShareTarget = (url: string) => {
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        if (!popup) window.location.href = url;
    };

    const openExternal = (url: string) => {
        const opener = document.createElement('a');
        opener.href = url;
        document.body.appendChild(opener);
        opener.click();
        opener.remove();
    };

    const shareMessage = `${shareText}\n${postUrl}`;

    /** Local addresses often reject the url field, so share the message text instead. */
    const pickShareData = (): ShareData | null => {
        const host = window.location.hostname.toLowerCase();
        const privateHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]'
            || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
        const textOnly: ShareData = { title: shareText, text: shareMessage };
        const withUrl: ShareData = { title: shareText, text: shareText, url: postUrl };
        const candidates = privateHost
            ? [textOnly, { text: shareMessage }]
            : [withUrl, { title: shareText, url: postUrl }, textOnly];
        if (typeof navigator.canShare !== 'function') return candidates[0];
        for (const data of candidates) {
            try {
                if (navigator.canShare(data)) return data;
            } catch {
                /* this browser cannot share that shape */
            }
        }
        return null;
    };

    /**
     * Open the installed app the way the APK does. Android uses an intent so
     * Chrome hands the post to that package. Everywhere else tries the app
     * scheme, then the website composer if the app did not take the screen.
     */
    const launchShareApp = (kind: 'whatsapp' | 'x' | 'facebook' | 'instagram' | 'threads') => {
        const message = `${shareText}\n${postUrl}`;
        const encodedMessage = encodeURIComponent(message);
        const encodedUrl = encodeURIComponent(postUrl);
        const targets = {
            whatsapp: {
                app: `whatsapp://send?text=${encodedMessage}`,
                web: `https://wa.me/?text=${encodedMessage}`,
                intent: `intent://send?text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(`https://wa.me/?text=${encodedMessage}`)};end`,
            },
            x: {
                app: `twitter://post?message=${encodedMessage}`,
                web: `https://twitter.com/intent/tweet?text=${encodedMessage}`,
                intent: `intent://post?message=${encodedMessage}#Intent;scheme=twitter;package=com.twitter.android;S.browser_fallback_url=${encodeURIComponent(`https://twitter.com/intent/tweet?text=${encodedMessage}`)};end`,
            },
            facebook: {
                app: `fb://share?link=${encodedUrl}`,
                web: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                intent: `intent://share?link=${encodedUrl}#Intent;scheme=fb;package=com.facebook.katana;S.browser_fallback_url=${encodeURIComponent(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)};end`,
            },
            instagram: {
                app: `instagram://sharesheet?text=${encodedMessage}`,
                web: `https://www.instagram.com/`,
                intent: `intent://sharesheet?text=${encodedMessage}#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent('https://www.instagram.com/')};end`,
            },
            threads: {
                app: `barcelona://create?text=${encodedMessage}`,
                web: `https://www.threads.net/intent/post?text=${encodedMessage}`,
                intent: `intent://www.threads.net/intent/post?text=${encodedMessage}#Intent;scheme=https;package=com.instagram.barcelona;S.browser_fallback_url=${encodeURIComponent(`https://www.threads.net/intent/post?text=${encodedMessage}`)};end`,
            },
        } as const;
        const target = targets[kind];
        const agent = navigator.userAgent || '';
        if (/Android/i.test(agent)) {
            window.location.href = target.intent;
            return;
        }
        if (/iPhone|iPad|iPod/i.test(agent)) {
            window.location.href = target.app;
            window.setTimeout(() => {
                if (document.visibilityState === 'visible') window.location.href = target.web;
            }, 900);
            return;
        }
        const opener = document.createElement('a');
        opener.href = target.app;
        opener.target = '_blank';
        opener.rel = 'noopener noreferrer';
        document.body.appendChild(opener);
        opener.click();
        opener.remove();
        window.setTimeout(() => {
            if (document.visibilityState === 'visible') openShareTarget(target.web);
        }, 700);
    };

    const handleRegenerateLink = async () => {
        if (!post.id || regeneratingToken) return;
        setRegeneratingToken(true);
        try {
            const updated = await regeneratePublicShareToken(post.id);
            if (!updated) {
                showToast?.('Could not reset link. Try again.');
                return;
            }
            setActiveShareToken(updated.token);
            await navigator.clipboard.writeText(updated.url);
            setCopied(true);
            showToast?.('Shared link reset and copied.');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to regenerate share token:', err);
            showToast?.('Could not reset link. Try again.');
        } finally {
            setRegeneratingToken(false);
            setShowResetConfirm(false);
        }
    };


    const toggleHandle = (handle: string) => {
        setSelectedHandles((prev) => (
            prev.includes(handle) ? prev.filter((item) => item !== handle) : [...prev, handle]
        ));
    };

    const handleSendSelected = async () => {
        if (!user?.handle || sending || selectedHandles.length === 0) return;
        setSending(true);
        const caption = shareCaption.trim();
        const recipients = [...selectedHandles];
        try {
            for (const recipientHandle of recipients) {
                await appendMessage(user.handle, recipientHandle, {
                    text: caption || postUrl,
                    sourcePostId: String(post.id),
                });
            }
            await recordShare();
            showToast?.(recipients.length === 1
                ? `Sent to ${recipients[0].split('@')[0] || recipients[0]}`
                : `Sent to ${recipients.length} people`);
            setShareCaption('');
            setSelectedHandles([]);
            onClose();
        } catch (err) {
            console.error('Send post to DM failed:', err);
            showToast?.('Could not send. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleShareVia = () => {
        if (typeof navigator.share === 'function') {
            const data = pickShareData();
            if (data) {
                // Must start in the click turn, or the browser rejects the sheet.
                navigator.share(data).then(() => {
                    void recordShare();
                    onClose();
                }).catch((err: unknown) => {
                    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
                    if (name === 'AbortError') return;
                    setShowViaMenu(true);
                });
                return;
            }
        }
        setShowViaMenu(true);
    };

    const finishViaChoice = (run: () => void) => {
        run();
        void recordShare();
        window.setTimeout(() => onClose(), 300);
    };

    const q = searchQuery.trim().toLowerCase();
    const filteredContacts = q
        ? followedContacts.filter(contact => contact.handle.toLowerCase().includes(q))
        : followedContacts;

    // Horizontal scrollable share options – Simple Icons for recognisable brand logos
    const iconWrap = (children: React.ReactNode, bg: string, className = '') => (
        <div className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${bg} ${className}`}>
            {children}
        </div>
    );
    const shareOptions = [
        {
            id: 'whatsapp' as const,
            label: 'WhatsApp',
            icon: iconWrap(<SiWhatsapp className="w-6 h-6 text-white" aria-hidden />, 'bg-[#25D366]'),
        },
        {
            id: 'x' as const,
            label: 'X',
            icon: iconWrap(<SiX className="w-5 h-5 text-white" aria-hidden />, 'bg-black'),
        },
        {
            id: 'facebook' as const,
            label: 'Facebook',
            icon: iconWrap(<SiFacebook className="w-6 h-6 text-white" aria-hidden />, 'bg-[#1877F2]'),
        },
        {
            id: 'instagram' as const,
            label: 'Instagram',
            icon: iconWrap(<SiInstagram className="w-6 h-6 text-white" aria-hidden />, 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]'),
        },
        {
            id: 'threads' as const,
            label: 'Threads',
            icon: iconWrap(<SiThreads className="w-5 h-5 text-white" aria-hidden />, 'bg-black'),
        },
    ];

    const sendLabel = selectedHandles.length === 0
        ? 'Send'
        : selectedHandles.length === 1
            ? `Send to ${selectedHandles[0].split('@')[0] || selectedHandles[0]}`
            : `Send to ${selectedHandles.length}`;

    return (
        <div className="fixed inset-0 z-[280] flex items-end justify-center bg-black/50" onClick={onClose}>
            <div
                className="relative flex max-h-[85%] w-full max-w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-t-xl border border-b-0 border-white/10"
                style={{ background: SHEET_GRADIENT }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-white/10 px-5 pb-4 pt-5">
                    <h2 className="text-lg font-semibold text-white">Share</h2>
                    <button type="button" onClick={onClose} className="text-sm font-medium text-white" aria-label="Close">
                        Close
                    </button>
                </div>
                <div className="px-5 pb-3 pt-3.5">
                    <div className="flex items-center gap-3.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2.5">
                        <FiSearch className="h-5 w-5 flex-shrink-0 text-[#94A3B8]" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#94A3B8]"
                        />
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    {loadingFollowed ? (
                        <div className="py-8 text-center text-sm text-[#D1E4FF]">Loading...</div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="py-8 text-center text-sm text-[#D1E4FF]">
                            {q ? 'No matches' : 'No people you follow yet'}
                        </div>
                    ) : (
                        filteredContacts.map(contact => {
                            const selected = selectedHandles.includes(contact.handle);
                            const photo = contact.avatarUrl ? rewriteMediaUrlForClient(contact.avatarUrl) : undefined;
                            return (
                                <button
                                    key={contact.handle}
                                    type="button"
                                    onClick={() => toggleHandle(contact.handle)}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                                >
                                    <Avatar src={photo} name={contact.handle.split('@')[0]} size="md" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                        {contact.handle.split('@')[0]}
                                    </span>
                                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-[#00F2FF] bg-[#00F2FF] text-black' : 'border-white/35 text-transparent'}`}>
                                        <FiCheck size={14} />
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
                {selectedHandles.length > 0 ? (
                    <div className="border-t border-white/10 px-4 py-3">
                        <p className="mb-2 truncate text-xs text-[#D1E4FF]">To: {selectedHandles.map((h) => h.split('@')[0]).join(', ')}</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={shareCaption}
                                onChange={(e) => setShareCaption(e.target.value)}
                                placeholder="Include message..."
                                className="min-w-0 flex-1 rounded-full border border-white/12 bg-[rgba(6,13,22,0.72)] px-3 py-2 text-sm text-white placeholder:text-[#94A3B8] outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => void handleSendSelected()}
                                disabled={sending}
                                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                            >
                                {sending ? 'Sending…' : sendLabel}
                            </button>
                        </div>
                    </div>
                ) : null}
                <div className="border-t border-white/10 px-4 pb-5 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white">Share to</p>
                        <button
                            type="button"
                            onClick={() => setShowResetConfirm(true)}
                            disabled={regeneratingToken}
                            className="text-[11px] text-[#00F2FF] disabled:opacity-60"
                        >
                            {regeneratingToken ? 'Resetting…' : 'Reset shared link'}
                        </button>
                    </div>
                    <div className="overflow-x-auto pb-2">
                        <div className="flex min-w-max items-center gap-5 px-1">
                            {shareOptions.map(({ id, label, icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        launchShareApp(id);
                                        void recordShare();
                                        window.setTimeout(() => onClose(), 300);
                                    }}
                                    className="flex min-w-[56px] flex-shrink-0 flex-col items-center gap-2"
                                >
                                    {icon}
                                    <span className="whitespace-nowrap text-[10px] text-[#D1E4FF]">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleShareVia();
                        }}
                        className="flex w-full items-center gap-3 py-2.5 text-left text-sm font-medium text-white"
                    >
                        <FiShare2 size={22} />
                        Share via…
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            void (async () => {
                                if (await handleCopyLink()) onClose();
                            })();
                        }}
                        className="flex w-full items-center gap-3 py-2.5 text-left text-sm font-medium text-white"
                    >
                        <FiLink size={22} />
                        {copied ? 'Copied!' : 'Copy link'}
                    </button>
                </div>
            </div>
            {showViaMenu && (
                <div
                    className="absolute inset-0 z-[290] flex items-end justify-center bg-black/50"
                    onClick={(event) => {
                        event.stopPropagation();
                        setShowViaMenu(false);
                    }}
                >
                    <div
                        className="w-full max-w-[min(400px,calc(100vw-32px))] rounded-t-xl border border-b-0 border-white/10 px-4 pb-5 pt-4"
                        style={{ background: SHEET_GRADIENT }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="mb-1 text-base font-semibold text-white">Share via</h3>
                        {(
                            [
                                {
                                    label: 'Messages',
                                    icon: <FiMessageCircle size={22} />,
                                    run: () => openExternal(/Android/i.test(navigator.userAgent || '')
                                        ? `sms:?body=${encodeURIComponent(shareMessage)}`
                                        : `sms:&body=${encodeURIComponent(shareMessage)}`),
                                },
                                {
                                    label: 'Mail',
                                    icon: <FiMail size={22} />,
                                    run: () => openExternal(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareMessage)}`),
                                },
                                { label: 'WhatsApp', icon: <SiWhatsapp size={22} />, run: () => launchShareApp('whatsapp') },
                                { label: 'X', icon: <SiX size={22} />, run: () => launchShareApp('x') },
                                { label: 'Facebook', icon: <SiFacebook size={22} />, run: () => launchShareApp('facebook') },
                                { label: 'Instagram', icon: <SiInstagram size={22} />, run: () => launchShareApp('instagram') },
                                { label: 'Threads', icon: <SiThreads size={22} />, run: () => launchShareApp('threads') },
                            ] as const
                        ).map((choice) => (
                            <button
                                key={choice.label}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    finishViaChoice(choice.run);
                                }}
                                className="flex w-full items-center gap-3 py-2.5 text-left text-sm font-medium text-white"
                            >
                                <span className="flex h-6 w-6 items-center justify-center text-white">{choice.icon}</span>
                                {choice.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setShowViaMenu(false)}
                            className="mt-1 w-full py-2.5 text-center text-sm font-medium text-[#D1E4FF]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {showResetConfirm && (
                <div className="absolute inset-0 z-[290] flex items-center justify-center bg-black/70 px-4">
                    <div className="w-full max-w-sm rounded-xl border border-white/12 p-4 shadow-2xl" style={{ background: SHEET_GRADIENT }}>
                        <h3 className="text-sm font-semibold text-white">Reset shared link?</h3>
                        <p className="mt-2 text-xs text-[#D1E4FF]">
                            Existing shared URLs for this post will stop working. A new link will be created and copied.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowResetConfirm(false)}
                                disabled={regeneratingToken}
                                className="rounded-md border border-white/35 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRegenerateLink}
                                disabled={regeneratingToken}
                                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                            >
                                {regeneratingToken ? 'Resetting…' : 'Reset link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShareModal;
