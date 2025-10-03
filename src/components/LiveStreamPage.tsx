import React, { useState, useRef, useEffect } from 'react';
import { FiArrowLeft, FiSend, FiHeart, FiUsers, FiShare2, FiMoreVertical, FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useLiveStreaming, LiveStream } from '../hooks/useLiveStreaming';
import { useAuth } from '../context/Auth';
import TouchFeedback from './TouchFeedback';

interface LiveStreamPageProps {
  streamId?: string;
  mode?: 'view' | 'create';
}

export default function LiveStreamPage({ streamId, mode = 'view' }: LiveStreamPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    streams,
    activeStream,
    isStreaming,
    isConnected,
    streamComments,
    streamReactions,
    viewerCounts,
    localVideoRef,
    remoteVideoRef,
    startStream,
    stopStream,
    joinStream,
    leaveStream,
    sendComment,
    sendReaction,
    toggleScreenShare
  } = useLiveStreaming();

  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(mode === 'create');
  
  // Stream creation form
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [streamTags, setStreamTags] = useState('');
  const [isPrivateStream, setIsPrivateStream] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamComments, activeStream?.id]);

  // Join stream on mount
  useEffect(() => {
    if (streamId && mode === 'view') {
      joinStream(streamId);
    }
    
    return () => {
      if (activeStream) {
        leaveStream();
      }
    };
  }, [streamId, mode]);

  // Handle comment submission
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeStream) return;
    
    sendComment(activeStream.id, commentText.trim());
    setCommentText('');
  };

  // Handle reaction tap
  const handleReactionTap = (e: React.MouseEvent, reaction: string) => {
    if (!activeStream || !videoContainerRef.current) return;
    
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    sendReaction(activeStream.id, reaction, x, y);
  };

  // Handle stream creation
  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamTitle.trim()) return;

    try {
      await startStream({
        title: streamTitle.trim(),
        description: streamDescription.trim() || undefined,
        category: streamCategory.trim() || undefined,
        tags: streamTags.split(',').map(tag => tag.trim()).filter(Boolean),
        isPrivate: isPrivateStream,
        settings: {
          allowComments: true,
          allowReactions: true,
          allowScreenShare: true,
          recordStream: false
        }
      });
      
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to start stream:', error);
      alert('Failed to start stream. Please check your camera and microphone permissions.');
    }
  };

  // Toggle audio
  const handleToggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Toggle video
  const handleToggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Toggle screen share
  const handleToggleScreenShare = async () => {
    await toggleScreenShare();
    setIsScreenSharing(!isScreenSharing);
  };

  // Format viewer count
  const formatViewerCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  // Show create form
  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <TouchFeedback onTap={() => navigate(-1)}>
              <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <FiArrowLeft size={20} />
              </div>
            </TouchFeedback>
            <h1 className="text-xl font-bold">Go Live</h1>
          </div>
        </div>

        {/* Preview */}
        <div className="relative bg-black aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-center text-white">
                <FiVideoOff size={48} className="mx-auto mb-2" />
                <p>Camera is off</p>
              </div>
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            <TouchFeedback onTap={handleToggleAudio}>
              <div className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-800/50' : 'bg-red-500'}`}>
                {isAudioEnabled ? <FiMic size={20} className="text-white" /> : <FiMicOff size={20} className="text-white" />}
              </div>
            </TouchFeedback>
            
            <TouchFeedback onTap={handleToggleVideo}>
              <div className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-800/50' : 'bg-red-500'}`}>
                {isVideoEnabled ? <FiVideo size={20} className="text-white" /> : <FiVideoOff size={20} className="text-white" />}
              </div>
            </TouchFeedback>
            
            <TouchFeedback onTap={handleToggleScreenShare}>
              <div className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-500' : 'bg-gray-800/50'}`}>
                <FiMonitor size={20} className="text-white" />
              </div>
            </TouchFeedback>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 p-4 overflow-y-auto">
          <form onSubmit={handleCreateStream} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stream Title *
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="What's your stream about?"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="Tell viewers what to expect..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={streamCategory}
                onChange={(e) => setStreamCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a category</option>
                <option value="gaming">Gaming</option>
                <option value="music">Music</option>
                <option value="art">Art & Creativity</option>
                <option value="cooking">Cooking</option>
                <option value="fitness">Fitness</option>
                <option value="education">Education</option>
                <option value="technology">Technology</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={streamTags}
                onChange={(e) => setStreamTags(e.target.value)}
                placeholder="gaming, fun, live (comma separated)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="private"
                checked={isPrivateStream}
                onChange={(e) => setIsPrivateStream(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="private" className="text-sm text-gray-700 dark:text-gray-300">
                Private stream (only followers can watch)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <TouchFeedback onTap={() => setShowCreateForm(false)}>
                <div className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-lg text-center font-medium text-gray-700 dark:text-gray-300">
                  Cancel
                </div>
              </TouchFeedback>
              
              <TouchFeedback onTap={handleCreateStream}>
                <div className="flex-1 py-3 px-4 bg-red-500 text-white rounded-lg text-center font-medium">
                  Go Live
                </div>
              </TouchFeedback>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Show stream list if no active stream
  if (!activeStream && !isStreaming) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <TouchFeedback onTap={() => navigate(-1)}>
              <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <FiArrowLeft size={20} />
              </div>
            </TouchFeedback>
            <h1 className="text-xl font-bold">Live Streams</h1>
          </div>
          
          <TouchFeedback onTap={() => setShowCreateForm(true)}>
            <div className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium">
              Go Live
            </div>
          </TouchFeedback>
        </div>

        {/* Connection status */}
        {!isConnected && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
              Connecting to live streams...
            </p>
          </div>
        )}

        {/* Streams grid */}
        <div className="p-4">
          {streams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FiVideo size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No live streams</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Be the first to go live!
              </p>
              <TouchFeedback onTap={() => setShowCreateForm(true)}>
                <div className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium">
                  Start Streaming
                </div>
              </TouchFeedback>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {streams.map((stream) => (
                <TouchFeedback
                  key={stream.id}
                  onTap={() => joinStream(stream.id)}
                  className="block"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="relative aspect-video bg-gray-900">
                      {stream.thumbnail ? (
                        <img
                          src={stream.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiVideo size={48} className="text-gray-400" />
                        </div>
                      )}
                      
                      {/* Live indicator */}
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                        LIVE
                      </div>
                      
                      {/* Viewer count */}
                      <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <FiUsers size={12} />
                        {formatViewerCount(viewerCounts[stream.id] || stream.viewerCount)}
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {stream.streamerAvatar ? (
                            <img
                              src={stream.streamerAvatar}
                              alt=""
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            stream.streamerName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {stream.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {stream.streamerName}
                          </p>
                          {stream.category && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {stream.category}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TouchFeedback>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show active stream
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Video container */}
      <div 
        ref={videoContainerRef}
        className="relative flex-1 bg-black"
        onDoubleClick={(e) => handleReactionTap(e, '❤️')}
      >
        {/* Video */}
        <video
          ref={isStreaming ? localVideoRef : remoteVideoRef}
          autoPlay
          muted={isStreaming}
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Stream reactions */}
        {activeStream && streamReactions[activeStream.id]?.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute pointer-events-none animate-bounce"
            style={{
              left: `${reaction.x}%`,
              top: `${reaction.y}%`,
              animation: 'float-up 3s ease-out forwards'
            }}
          >
            <span className="text-2xl">{reaction.reaction}</span>
          </div>
        ))}

        {/* Top overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4">
          <div className="flex items-center justify-between">
            <TouchFeedback onTap={() => navigate(-1)}>
              <div className="p-2 bg-black/30 rounded-full">
                <FiArrowLeft size={20} className="text-white" />
              </div>
            </TouchFeedback>
            
            <div className="flex items-center gap-2">
              {/* Live indicator */}
              <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                LIVE
              </div>
              
              {/* Viewer count */}
              <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                <FiUsers size={12} />
                {formatViewerCount(viewerCounts[activeStream?.id || ''] || activeStream?.viewerCount || 0)}
              </div>
            </div>
          </div>
          
          {/* Stream info */}
          <div className="mt-4">
            <h2 className="text-white font-bold text-lg">{activeStream?.title}</h2>
            <p className="text-white/80 text-sm">{activeStream?.streamerName}</p>
          </div>
        </div>

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          {isStreaming ? (
            /* Streamer controls */
            <div className="flex items-center justify-center gap-4">
              <TouchFeedback onTap={handleToggleAudio}>
                <div className={`p-3 rounded-full ${isAudioEnabled ? 'bg-white/20' : 'bg-red-500'}`}>
                  {isAudioEnabled ? <FiMic size={20} className="text-white" /> : <FiMicOff size={20} className="text-white" />}
                </div>
              </TouchFeedback>
              
              <TouchFeedback onTap={handleToggleVideo}>
                <div className={`p-3 rounded-full ${isVideoEnabled ? 'bg-white/20' : 'bg-red-500'}`}>
                  {isVideoEnabled ? <FiVideo size={20} className="text-white" /> : <FiVideoOff size={20} className="text-white" />}
                </div>
              </TouchFeedback>
              
              <TouchFeedback onTap={handleToggleScreenShare}>
                <div className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-500' : 'bg-white/20'}`}>
                  <FiMonitor size={20} className="text-white" />
                </div>
              </TouchFeedback>
              
              <TouchFeedback onTap={stopStream}>
                <div className="px-6 py-3 bg-red-500 rounded-full">
                  <span className="text-white font-medium">End Stream</span>
                </div>
              </TouchFeedback>
            </div>
          ) : (
            /* Viewer reactions */
            <div className="flex items-center justify-center gap-4">
              {['❤️', '👏', '😂', '😮', '🔥'].map((emoji) => (
                <TouchFeedback
                  key={emoji}
                  onTap={(e) => handleReactionTap(e as any, emoji)}
                >
                  <div className="p-3 bg-white/20 rounded-full">
                    <span className="text-2xl">{emoji}</span>
                  </div>
                </TouchFeedback>
              ))}
            </div>
          )}
        </div>

        {/* Comments toggle */}
        <TouchFeedback onTap={() => setShowComments(!showComments)}>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/30 rounded-full">
            <FiX size={20} className={`text-white transform transition-transform ${showComments ? 'rotate-45' : ''}`} />
          </div>
        </TouchFeedback>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="h-64 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex flex-col">
          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeStream && streamComments[activeStream.id]?.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {comment.userAvatar ? (
                    <img
                      src={comment.userAvatar}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    comment.userName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {comment.userName}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 ml-2">
                      {comment.content}
                    </span>
                  </p>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Comment input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Say something..."
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={!isConnected}
              />
              <TouchFeedback onTap={handleSendComment}>
                <div className={`p-2 rounded-full ${
                  commentText.trim() && isConnected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  <FiSend size={16} />
                </div>
              </TouchFeedback>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}



