import { useState } from 'react';
import { FiShare2, FiCopy, FiX, FiCheck } from 'react-icons/fi';
import { FaTwitter, FaFacebook, FaWhatsapp, FaTelegram, FaLinkedin, FaReddit } from 'react-icons/fa';
import { cn } from '../utils/cn';
import type { Post } from '../types';

interface ShareModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (platform: string) => void;
}

export default function ShareModal({ post, isOpen, onClose, onShare }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/post/${post.id}`;
  const shareText = `Check out this post by ${post.userHandle}@${post.locationLabel.toLowerCase().replace(/\s+/g, '')}: ${post.tags.join(' ')}`;
  const shareTitle = `Post by ${post.userHandle}@${post.locationLabel.toLowerCase().replace(/\s+/g, '')}`;

  const shareOptions = [
    {
      id: 'native',
      name: 'More',
      icon: FiShare2,
      color: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
      action: () => handleNativeShare()
    },
    {
      id: 'copy',
      name: 'Copy Link',
      icon: copied ? FiCheck : FiCopy,
      color: copied ? 'bg-green-100 hover:bg-green-200 text-green-700' : 'bg-blue-100 hover:bg-blue-200 text-blue-700',
      action: () => handleCopyLink()
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: FaTwitter,
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-600',
      action: () => handleSocialShare('twitter')
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: FaFacebook,
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-600',
      action: () => handleSocialShare('facebook')
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: FaWhatsapp,
      color: 'bg-green-50 hover:bg-green-100 text-green-600',
      action: () => handleSocialShare('whatsapp')
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: FaTelegram,
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-600',
      action: () => handleSocialShare('telegram')
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: FaLinkedin,
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-600',
      action: () => handleSocialShare('linkedin')
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: FaReddit,
      color: 'bg-orange-50 hover:bg-orange-100 text-orange-600',
      action: () => handleSocialShare('reddit')
    }
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        onShare?.('native');
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onShare?.('copy');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleSocialShare = (platform: string) => {
    setIsSharing(platform);
    
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    
    let shareUrl_platform = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl_platform = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl_platform = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareUrl_platform = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'telegram':
        shareUrl_platform = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'linkedin':
        shareUrl_platform = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'reddit':
        shareUrl_platform = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
        break;
    }
    
    // Open in new window
    window.open(shareUrl_platform, '_blank', 'width=600,height=400');
    
    onShare?.(platform);
    
    // Reset sharing state
    setTimeout(() => setIsSharing(null), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl md:rounded-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Share Post
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <FiX size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Post Preview */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {post.userHandle.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {post.userHandle}@{post.locationLabel.toLowerCase().replace(/\s+/g, '')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {post.locationLabel}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <img
              src={post.mediaUrl}
              alt="Post preview"
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        </div>

        {/* Share Options */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3">
            {shareOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={option.action}
                  disabled={isSharing === option.id}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95",
                    option.color,
                    isSharing === option.id && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <IconComponent size={24} />
                  <span className="text-xs font-medium mt-1">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Share this post with your friends and followers
          </p>
        </div>
      </div>
    </div>
  );
}
