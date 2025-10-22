import { useState, useRef, useCallback, useEffect } from 'react';
import {
    MediaStream,
    RTCPeerConnection,
    RTCView,
    mediaDevices,
} from 'react-native-webrtc';
import io from 'socket.io-client';

interface LiveStream {
    id: string;
    title: string;
    streamerId: string;
    streamerName: string;
    streamerAvatar: string;
    isLive: boolean;
    category?: string;
    tags?: string[];
    isPrivate?: boolean;
    settings?: {
        allowComments: boolean;
        allowReactions: boolean;
        allowScreenShare: boolean;
        recordStream: boolean;
    };
}

interface StreamComment {
    id: string;
    streamId: string;
    userId: string;
    username: string;
    message: string;
    timestamp: number;
}

interface StreamReaction {
    id: string;
    streamId: string;
    userId: string;
    reaction: string;
    timestamp: number;
    x: number;
    y: number;
}

interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: number;
}

export const useLiveStreaming = () => {
    const [streams, setStreams] = useState<LiveStream[]>([]);
    const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamComments, setStreamComments] = useState<{ [streamId: string]: StreamComment[] }>({});
    const [streamReactions, setStreamReactions] = useState<{ [streamId: string]: StreamReaction[] }>({});
    const [viewerCounts, setViewerCounts] = useState<{ [streamId: string]: number }>({});
    const [isConnected, setIsConnected] = useState(false);

    // WebRTC refs
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const socketRef = useRef<any>(null);

    // WebSocket connection
    useEffect(() => {
        const socket = io('ws://localhost:3001', {
            transports: ['websocket'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to WebSocket');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
            setIsConnected(false);
        });

        socket.on('stream_started', (data: LiveStream) => {
            setStreams(prev => [...prev, data]);
        });

        socket.on('stream_ended', (data: { streamId: string }) => {
            setStreams(prev => prev.filter(s => s.id !== data.streamId));
            if (activeStream?.id === data.streamId) {
                setActiveStream(null);
            }
        });

        socket.on('stream_comment', (data: StreamComment) => {
            setStreamComments(prev => ({
                ...prev,
                [data.streamId]: [...(prev[data.streamId] || []), data],
            }));
        });

        socket.on('stream_reaction', (data: StreamReaction) => {
            setStreamReactions(prev => ({
                ...prev,
                [data.streamId]: [...(prev[data.streamId] || []), data],
            }));
        });

        socket.on('viewer_count_updated', (data: { streamId: string; count: number }) => {
            setViewerCounts(prev => ({
                ...prev,
                [data.streamId]: data.count,
            }));
        });

        socket.on('webrtc_offer', async (data: any) => {
            await handleWebRTCOffer(data);
        });

        socket.on('webrtc_answer', async (data: any) => {
            await handleWebRTCAnswer(data);
        });

        socket.on('webrtc_ice_candidate', async (data: any) => {
            await handleWebRTCIceCandidate(data);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Setup peer connection
    const setupPeerConnection = useCallback(() => {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        };

        const peerConnection = new RTCPeerConnection(configuration) as any;

        peerConnection.onicecandidate = (event: any) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('webrtc_ice_candidate', {
                    candidate: event.candidate,
                    streamId: activeStream?.id,
                });
            }
        };

        peerConnection.onaddstream = (event: any) => {
            remoteStreamRef.current = event.stream;
        };

        peerConnectionRef.current = peerConnection;
        return peerConnection;
    }, [activeStream?.id]);

    // Start streaming
    const startStream = useCallback(async (streamConfig: {
        title: string;
        description?: string;
        category?: string;
        tags?: string[];
        isPrivate?: boolean;
        settings?: Partial<LiveStream['settings']>;
    }) => {
        if (!isConnected) return null;

        try {
            // Get user media
            const stream = await mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                } as any,
            });

            localStreamRef.current = stream;

            // Setup peer connection
            const pc = setupPeerConnection();

            // Add local stream to peer connection
            (pc as any).addStream(stream);

            // Create stream
            const streamData: any = {
                title: streamConfig.title,
                description: streamConfig.description,
                streamerId: 'current-user-id', // Replace with actual user ID
                streamerName: 'Current User', // Replace with actual user name
                streamerAvatar: 'https://via.placeholder.com/150', // Replace with actual avatar
                isLive: true,
                category: streamConfig.category,
                tags: streamConfig.tags || [],
                isPrivate: streamConfig.isPrivate || false,
                settings: {
                    allowComments: true,
                    allowReactions: true,
                    allowScreenShare: false,
                    recordStream: false,
                    ...streamConfig.settings,
                },
            };

            socketRef.current?.emit('start_stream', streamData);
            setIsStreaming(true);
            return streamData;

        } catch (error) {
            console.error('Error starting stream:', error);
            throw error;
        }
    }, [isConnected, setupPeerConnection]);

    // Stop streaming
    const stopStream = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        socketRef.current?.emit('stop_stream', { streamId: activeStream?.id });
        setIsStreaming(false);
        setActiveStream(null);
    }, [activeStream?.id]);

    // Join stream
    const joinStream = useCallback(async (streamId: string) => {
        try {
            const stream = streams.find(s => s.id === streamId);
            if (!stream) return;

            setActiveStream(stream);

            // Setup peer connection for viewing
            const pc = setupPeerConnection();

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socketRef.current?.emit('webrtc_offer', {
                offer,
                streamId,
            });

        } catch (error) {
            console.error('Error joining stream:', error);
        }
    }, [streams, setupPeerConnection]);

    // Leave stream
    const leaveStream = useCallback(() => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        remoteStreamRef.current = null;
        setActiveStream(null);
    }, []);

    // Send comment
    const sendComment = useCallback((streamId: string, message: string) => {
        const comment: Omit<StreamComment, 'id' | 'timestamp'> = {
            streamId,
            userId: 'current-user-id', // Replace with actual user ID
            username: 'Current User', // Replace with actual username
            message,
        };

        socketRef.current?.emit('stream_comment', comment);
    }, []);

    // Send reaction
    const sendReaction = useCallback((streamId: string, reaction: string, x: number, y: number) => {
        const reactionData: Omit<StreamReaction, 'id' | 'timestamp'> = {
            streamId,
            userId: 'current-user-id', // Replace with actual user ID
            reaction,
            x,
            y,
        };

        socketRef.current?.emit('stream_reaction', reactionData);
    }, []);

    // WebRTC handlers
    const handleWebRTCOffer = async (data: any) => {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(data.offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socketRef.current?.emit('webrtc_answer', {
            answer,
            streamId: data.streamId,
        });
    };

    const handleWebRTCAnswer = async (data: any) => {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(data.answer);
    };

    const handleWebRTCIceCandidate = async (data: any) => {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.addIceCandidate(data.candidate);
    };

    return {
        streams,
        activeStream,
        isStreaming,
        streamComments,
        streamReactions,
        viewerCounts,
        isConnected,
        localStreamRef,
        remoteStreamRef,
        startStream,
        stopStream,
        joinStream,
        leaveStream,
        sendComment,
        sendReaction,
    };
};
