import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiShare2 } from 'react-icons/fi';
import { getPublicPostByToken } from '../api/posts';
import { getPostById } from '../api/posts';
import type { Post } from '../types';
import { updateMetaTags, clearMetaTags } from '../utils/metaTags';
import { storePublicShareReturnPath } from '../utils/publicShare';
import { useAuth } from '../context/Auth';

export default function PublicPostPage() {
  const { token, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = React.useState<Post | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function run() {
      if (!token && !id) {
        setError('Missing share link.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = token ? await getPublicPostByToken(token) : await getPostById(String(id));
      if (!mounted) return;
      if (!result) {
        setError('This shared post is unavailable.');
      } else {
        setPost(result);
      }
      setLoading(false);
    }
    run();
    return () => {
      mounted = false;
    };
  }, [token, id]);

  React.useEffect(() => {
    if (!post) return;
    const titleText = (post.text || post.caption || 'Shared post').slice(0, 80);
    updateMetaTags({
      title: `${titleText} • ${post.userHandle}`,
      description: (post.caption || post.text || 'View this shared post').slice(0, 200),
      image: post.mediaUrl,
      url: window.location.href,
      type: 'article',
    });
    return () => clearMetaTags();
  }, [post]);

  const goToAuth = (mode: 'signup' | 'login') => {
    if (token) {
      storePublicShareReturnPath(`/p/${token}`);
    }
    navigate(`/login?mode=${mode}`);
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading post…</div>;
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="text-lg font-semibold">Post not available</p>
        <p className="text-sm text-gray-400">{error || 'This shared post could not be loaded.'}</p>
        <Link to="/landing" className="text-sky-400 hover:text-sky-300">Go to landing page</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {post.mediaUrl ? (
            post.mediaType === 'video' ? (
              <video src={post.mediaUrl} controls className="w-full max-h-[70vh] bg-black" preload="metadata" />
            ) : (
              <img src={post.mediaUrl} alt="Shared post" className="w-full object-cover max-h-[70vh]" />
            )
          ) : null}
          <div className="p-4 space-y-2">
            <p className="font-semibold">{post.userHandle}</p>
            {post.text && <p className="text-sm text-gray-200">{post.text}</p>}
            {post.caption && post.caption !== post.text && <p className="text-sm text-gray-300">{post.caption}</p>}
          </div>
          <div className="px-4 pb-4 flex items-center gap-6 text-gray-400">
            <button type="button" onClick={() => goToAuth('signup')} className="flex items-center gap-2 hover:text-white">
              <FiHeart /> <span>{post.stats.likes}</span>
            </button>
            <button type="button" onClick={() => goToAuth('signup')} className="flex items-center gap-2 hover:text-white">
              <FiMessageCircle /> <span>{post.stats.comments}</span>
            </button>
            <button type="button" onClick={() => goToAuth('signup')} className="flex items-center gap-2 hover:text-white">
              <FiShare2 /> <span>{post.stats.shares}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
          <p className="text-sm text-sky-100">
            {user ? 'Sign in to unlock all interactions and feed navigation.' : 'Join now to like, comment, follow, and keep exploring.'}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => goToAuth('signup')}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => goToAuth('login')}
              className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 text-sm"
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

