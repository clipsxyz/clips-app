import React from 'react';
import { FiLoader, FiCheck, FiX } from 'react-icons/fi';
import { getRenderJobStatus } from '../api/client';

export type ProcessingVideo = {
  jobId: string;
  postId: string;
  videoUrl: string; // Original video URL for thumbnail
  thumbnailUrl?: string;
};

interface ProcessingVideoPiPProps {
  video: ProcessingVideo;
  onComplete: (jobId: string) => void;
  onDismiss: (jobId: string) => void;
}

export default function ProcessingVideoPiP({ video, onComplete, onDismiss }: ProcessingVideoPiPProps) {
  const [status, setStatus] = React.useState<'queued' | 'generating_music' | 'rendering' | 'completed' | 'failed'>('queued');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    // Start polling for job status
    const pollStatus = async () => {
      try {
        const response = await getRenderJobStatus(video.jobId);
        setStatus(response.status);
        
        if (response.status === 'completed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Wait a moment to show success state, then notify parent
          setTimeout(() => {
            onComplete(video.jobId);
          }, 2000);
        } else if (response.status === 'failed') {
          setErrorMessage(response.errorMessage || 'Processing failed');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error polling render job status:', error);
      }
    };

    // Poll immediately, then every 2 seconds
    pollStatus();
    pollingIntervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [video.jobId, onComplete]);

  const getStatusText = () => {
    switch (status) {
      case 'queued':
        return 'Queued...';
      case 'generating_music':
        return 'Adding music...';
      case 'rendering':
        return 'Processing...';
      case 'completed':
        return 'Posted!';
      case 'failed':
        return 'Failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      return <FiCheck className="w-4 h-4 text-green-500" />;
    }
    if (status === 'failed') {
      return <FiX className="w-4 h-4 text-red-500" />;
    }
    return <FiLoader className="w-4 h-4 animate-spin text-blue-500" />;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Video Thumbnail */}
      <div className="relative w-full aspect-[9/16] bg-black">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt="Processing video"
            className="w-full h-full object-cover"
          />
        ) : video.videoUrl ? (
          <video
            src={video.videoUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
            loop
            onError={(e) => {
              console.error('PiP video load error:', e);
              // If video fails to load, show placeholder
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <div className="text-white text-xs">Video Processing</div>
          </div>
        )}
        
        {/* Overlay with status */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          {status !== 'completed' && status !== 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <FiLoader className="w-6 h-6 text-white animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {getStatusText()}
            </span>
          </div>
          
          {status !== 'completed' && (
            <button
              onClick={() => onDismiss(video.jobId)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Dismiss"
            >
              <FiX className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress indicator (simple animated bar for active states) */}
        {(status === 'queued' || status === 'generating_music' || status === 'rendering') && (
          <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {/* Error message */}
        {status === 'failed' && errorMessage && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400 truncate">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}

