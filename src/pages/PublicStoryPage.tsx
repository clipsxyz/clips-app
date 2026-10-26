import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { fetchPublicStory } from '../api/stories';
import type { Story } from '../types';
import { updateMetaTags, clearMetaTags } from '../utils/metaTags';

export default function PublicStoryPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const handle = (params.get('user') || '').trim();
    const storyId = (params.get('story') || '').trim();

    const [story, setStory] = React.useState<Story | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;
        async function run() {
            if (!handle || !storyId) {
                setError('Missing share link.');
                setLoading(false);
                return;
            }
            setLoading(true);
            const result = await fetchPublicStory(handle, storyId);
            if (!mounted) return;
            if (!result) {
                setError('This story is unavailable.');
            } else {
                setStory(result);
            }
            setLoading(false);
        }
        void run();
        return () => {
            mounted = false;
        };
    }, [handle, storyId]);

    React.useEffect(() => {
        if (!story) return;
        const titleText = (story.text || 'Shared story').slice(0, 80);
        updateMetaTags({
            title: `${titleText} • ${story.userHandle}`,
            description: (story.text || 'View this shared story').slice(0, 200),
            image: story.videoPosterUrl || (story.mediaType !== 'video' ? story.mediaUrl : undefined),
            url: window.location.href,
            type: 'article',
        });
        return () => clearMetaTags();
    }, [story]);

    const goLanding = () => navigate('/landing', { replace: true });
    const goAuth = (mode: 'signup' | 'login') => navigate(`/login?mode=${mode}`);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading story…
            </div>
        );
    }

    if (error || !story) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center gap-3">
                <p className="text-lg font-semibold">Story not available</p>
                <p className="text-sm text-gray-400">{error || 'This shared story could not be loaded.'}</p>
                <button type="button" onClick={goLanding} className="text-sky-400 hover:text-sky-300">
                    Go to landing page
                </button>
            </div>
        );
    }

    const isVideo = story.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(story.mediaUrl || '');
    const imageUrl =
        story.mediaType !== 'video' && story.mediaUrl
            ? story.mediaUrl
            : story.videoPosterUrl || undefined;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <button type="button" onClick={goLanding} className="text-white text-lg" aria-label="Close">
                    ×
                </button>
                <button type="button" onClick={goLanding} className="text-sm font-semibold">
                    {story.userHandle}
                </button>
                <span className="w-5" />
            </div>

            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                {isVideo && story.mediaUrl ? (
                    <video
                        src={story.mediaUrl}
                        poster={story.videoPosterUrl}
                        controls
                        autoPlay
                        playsInline
                        className="max-h-[70vh] w-full object-contain bg-black"
                    />
                ) : imageUrl ? (
                    <img src={imageUrl} alt="" className="max-h-[70vh] w-full object-contain" />
                ) : (
                    <p className="px-6 text-center text-lg font-medium">{story.text || 'Story'}</p>
                )}
            </div>

            {story.text && (isVideo || imageUrl) ? (
                <p className="px-4 py-3 text-sm text-gray-200">{story.text}</p>
            ) : null}

            <div className="px-4 pb-8">
                {user ? (
                    <button
                        type="button"
                        onClick={() => navigate('/feed')}
                        className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold"
                    >
                        Open Gazetteer
                    </button>
                ) : (
                    <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                        <p className="text-sm text-gray-200">
                            Create an account to keep exploring, reply, and follow.
                        </p>
                        <div className="mt-3 flex gap-3">
                            <button
                                type="button"
                                onClick={() => goAuth('signup')}
                                className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-semibold"
                            >
                                Sign up
                            </button>
                            <button
                                type="button"
                                onClick={() => goAuth('login')}
                                className="flex-1 py-2.5 rounded-lg border border-white/30 text-sm"
                            >
                                Log in
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
