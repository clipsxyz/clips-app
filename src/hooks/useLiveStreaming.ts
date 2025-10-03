import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { useAuth } from '../context/Auth';

export interface LiveStream {
  id: string;
  title: string;
  description?: string;
  streamerId: string;
  streamerName: string;
  streamerAvatar?: string;
  thumbnail?: string;
  viewerCount: number;
  isLive: boolean;
  startedAt: number;
  endedAt?: number;
  category?: string;
  tags: string[];
  isPrivate: boolean;
  allowedViewers?: string[];
  settings: {
    allowComments: boolean;
    allowReactions: boolean;
    allowScreenShare: boolean;
    maxViewers?: number;
    recordStream: boolean;
  };
}

export interface StreamComment {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: number;
  type: 'comment' | 'system' | 'donation' | 'reaction';
  metadata?: {
    amount?: number;
    currency?: string;
    reaction?: string;
  };
}

export interface StreamReaction {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  reaction: string;
  timestamp: number;
  x: number; // Position on screen
  y: number;
}

export const useLiveStreaming = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamComments, setStreamComments] = useState<{ [streamId: string]: StreamComment[] }>({});
  const [streamReactions, setStreamReactions] = useState<{ [streamId: string]: StreamReaction[] }>({});
  const [viewerCounts, setViewerCounts] = useState<{ [streamId: string]: number }>({});
  
  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'stream_started':
        handleStreamStarted(wsMessage.data);
        break;
      case 'stream_ended':
        handleStreamEnded(wsMessage.data);
        break;
      case 'stream_updated':
        handleStreamUpdated(wsMessage.data);
        break;
      case 'stream_comment':
        handleStreamComment(wsMessage.data);
        break;
      case 'stream_reaction':
        handleStreamReaction(wsMessage.data);
        break;
      case 'viewer_count_updated':
        handleViewerCountUpdate(wsMessage.data);
        break;
      case 'webrtc_offer':
        handleWebRTCOffer(wsMessage.data);
        break;
      case 'webrtc_answer':
        handleWebRTCAnswer(wsMessage.data);
        break;
      case 'webrtc_ice_candidate':
        handleWebRTCIceCandidate(wsMessage.data);
        break;
    }
  }, []);

  const { isConnected, send } = useWebSocket({
    onMessage: handleWebSocketMessage
  });

  // Handle stream events
  const handleStreamStarted = useCallback((stream: LiveStream) => {
    setStreams(prev => [stream, ...prev.filter(s => s.id !== stream.id)]);
  }, []);

  const handleStreamEnded = useCallback((data: { streamId: string; endedAt: number }) => {
    setStreams(prev => prev.map(stream =>
      stream.id === data.streamId
        ? { ...stream, isLive: false, endedAt: data.endedAt }
        : stream
    ));
    
    if (activeStream?.id === data.streamId) {
      setActiveStream(prev => prev ? { ...prev, isLive: false, endedAt: data.endedAt } : null);
    }
  }, [activeStream]);

  const handleStreamUpdated = useCallback((updatedStream: LiveStream) => {
    setStreams(prev => prev.map(stream =>
      stream.id === updatedStream.id ? updatedStream : stream
    ));
    
    if (activeStream?.id === updatedStream.id) {
      setActiveStream(updatedStream);
    }
  }, [activeStream]);

  const handleStreamComment = useCallback((comment: StreamComment) => {
    setStreamComments(prev => ({
      ...prev,
      [comment.streamId]: [...(prev[comment.streamId] || []), comment]
    }));
  }, []);

  const handleStreamReaction = useCallback((reaction: StreamReaction) => {
    setStreamReactions(prev => ({
      ...prev,
      [reaction.streamId]: [...(prev[reaction.streamId] || []), reaction]
    }));
    
    // Remove reaction after animation (3 seconds)
    setTimeout(() => {
      setStreamReactions(prev => ({
        ...prev,
        [reaction.streamId]: (prev[reaction.streamId] || []).filter(r => r.id !== reaction.id)
      }));
    }, 3000);
  }, []);

  const handleViewerCountUpdate = useCallback((data: { streamId: string; count: number }) => {
    setViewerCounts(prev => ({
      ...prev,
      [data.streamId]: data.count
    }));
    
    setStreams(prev => prev.map(stream =>
      stream.id === data.streamId ? { ...stream, viewerCount: data.count } : stream
    ));
  }, []);

  // WebRTC handlers
  const handleWebRTCOffer = useCallback(async (data: { offer: RTCSessionDescriptionInit; streamId: string }) => {
    if (!peerConnectionRef.current) {
      setupPeerConnection();
    }
    
    try {
      await peerConnectionRef.current?.setRemoteDescription(data.offer);
      const answer = await peerConnectionRef.current?.createAnswer();
      await peerConnectionRef.current?.setLocalDescription(answer);
      
      send({
        type: 'webrtc_answer',
        data: { answer, streamId: data.streamId },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  }, [send]);

  const handleWebRTCAnswer = useCallback(async (data: { answer: RTCSessionDescriptionInit }) => {
    try {
      await peerConnectionRef.current?.setRemoteDescription(data.answer);
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  }, []);

  const handleWebRTCIceCandidate = useCallback(async (data: { candidate: RTCIceCandidateInit }) => {
    try {
      await peerConnectionRef.current?.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, []);

  // Setup WebRTC peer connection
  const setupPeerConnection = useCallback(() => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers for production
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'username',
        //   credential: 'password'
        // }
      ]
    };

    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && activeStream) {
        send({
          type: 'webrtc_ice_candidate',
          data: { candidate: event.candidate, streamId: activeStream.id },
          timestamp: Date.now()
        });
      }
    };

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle connection state changes
    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', peerConnectionRef.current?.connectionState);
    };

    return peerConnectionRef.current;
  }, [activeStream, send]);

  // Start streaming
  const startStream = useCallback(async (streamConfig: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    isPrivate?: boolean;
    settings?: Partial<LiveStream['settings']>;
  }) => {
    if (!user || !isConnected) return null;

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup peer connection
      const pc = setupPeerConnection();
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create stream
      const streamData: Omit<LiveStream, 'id' | 'viewerCount' | 'startedAt'> = {
        title: streamConfig.title,
        description: streamConfig.description,
        streamerId: user.id,
        streamerName: user.name,
        streamerAvatar: user.profileImage,
        isLive: true,
        category: streamConfig.category,
        tags: streamConfig.tags || [],
        isPrivate: streamConfig.isPrivate || false,
        settings: {
          allowComments: true,
          allowReactions: true,
          allowScreenShare: false,
          recordStream: false,
          ...streamConfig.settings
        }
      };

      const messageId = send({
        type: 'start_stream',
        data: streamData,
        timestamp: Date.now()
      });

      setIsStreaming(true);
      return messageId;

    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }, [user, isConnected, send, setupPeerConnection]);

  // Stop streaming
  const stopStream = useCallback(() => {
    if (!activeStream || !isStreaming) return;

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Notify server
    send({
      type: 'stop_stream',
      data: { streamId: activeStream.id },
      timestamp: Date.now()
    });

    setIsStreaming(false);
    setActiveStream(null);
  }, [activeStream, isStreaming, send]);

  // Join stream as viewer
  const joinStream = useCallback(async (streamId: string) => {
    if (!user || !isConnected) return;

    const stream = streams.find(s => s.id === streamId);
    if (!stream) return;

    setActiveStream(stream);

    // Setup peer connection for viewing
    setupPeerConnection();

    // Join stream
    send({
      type: 'join_stream',
      data: { streamId, userId: user.id },
      timestamp: Date.now()
    });

  }, [user, isConnected, streams, send, setupPeerConnection]);

  // Leave stream
  const leaveStream = useCallback(() => {
    if (!activeStream) return;

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Notify server
    send({
      type: 'leave_stream',
      data: { streamId: activeStream.id, userId: user?.id },
      timestamp: Date.now()
    });

    setActiveStream(null);
  }, [activeStream, user, send]);

  // Send comment
  const sendComment = useCallback((streamId: string, content: string) => {
    if (!user || !isConnected) return;

    const comment: Omit<StreamComment, 'id'> = {
      streamId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.profileImage,
      content,
      timestamp: Date.now(),
      type: 'comment'
    };

    send({
      type: 'stream_comment',
      data: comment,
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Send reaction
  const sendReaction = useCallback((streamId: string, reaction: string, x: number, y: number) => {
    if (!user || !isConnected) return;

    const reactionData: Omit<StreamReaction, 'id'> = {
      streamId,
      userId: user.id,
      userName: user.name,
      reaction,
      timestamp: Date.now(),
      x,
      y
    };

    send({
      type: 'stream_reaction',
      data: reactionData,
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!isStreaming || !peerConnectionRef.current) return;

    try {
      if (localStreamRef.current?.getVideoTracks()[0].label.includes('screen')) {
        // Stop screen share, switch back to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );

        if (sender) {
          await sender.replaceTrack(videoTrack);
        }

        localStreamRef.current = cameraStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream;
        }

      } else {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );

        if (sender) {
          await sender.replaceTrack(videoTrack);
        }

        // Handle screen share end
        videoTrack.onended = () => {
          toggleScreenShare(); // Switch back to camera
        };

        localStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [isStreaming]);

  // Load live streams on mount
  useEffect(() => {
    if (user && isConnected) {
      send({
        type: 'load_live_streams',
        data: { userId: user.id },
        timestamp: Date.now()
      });
    }
  }, [user, isConnected, send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return {
    streams: streams.filter(s => s.isLive),
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
  };
};



