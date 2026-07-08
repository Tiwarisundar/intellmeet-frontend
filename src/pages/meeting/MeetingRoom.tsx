import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  LogOut, PhoneOff, Send, Users, Copy, Check, X,
  UserCheck, UserX, Hand, Monitor, MonitorOff,
  Settings, Flag, ChevronUp, Captions
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getMeeting, endMeeting } from '../../services/meetingService';

const MAX_FREE_JOINS = 3;
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

interface RemoteStream {
  userId: string;
  userName: string;
  stream: MediaStream;
  isScreenShare?: boolean;
}

const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Meeting state
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // UI state
  const [copied, setCopied] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [captions, setCaptions] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Join approval state
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [joinRejected, setJoinRejected] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Join count helpers
  const getJoinCount = () => parseInt(localStorage.getItem(`im_join_${id}`) || '0');
  const incrementJoinCount = () => {
    const count = getJoinCount() + 1;
    localStorage.setItem(`im_join_${id}`, count.toString());
    return count;
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // ==================== SETUP ====================
  useEffect(() => {
    fetchMeeting();
    startLocalStream().then(() => {
      const count = getJoinCount();
      if (count >= MAX_FREE_JOINS) {
        setWaitingForApproval(true);
        setupSocket(false);
        setTimeout(() => requestApproval(), 1200);
      } else {
        incrementJoinCount();
        setupSocket(true);
      }
    });

    return () => {
      cleanup();
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showChat) setUnreadMessages(prev => prev + 1);
    else setUnreadMessages(0);
  }, [messages.length]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ==================== CLEANUP ====================
  const cleanup = () => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    // Disconnect socket
    socketRef.current?.disconnect();
  };

  // ==================== MEDIA ====================
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Camera/mic access denied:', err);
      // Try audio only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioOnly;
        setIsVideoOff(true);
        return audioOnly;
      } catch {
        return null;
      }
    }
  };

  // ==================== FETCH MEETING ====================
  const fetchMeeting = async () => {
    try {
      const response = await getMeeting(id!);
      setMeeting(response.meeting);
      const hostId = response.meeting?.host?._id || response.meeting?.host;
      setIsHost(hostId === user?.id);
    } catch (err) {
      console.error('Meeting fetch failed');
    }
  };

  // ==================== WEBRTC ====================
  const createPeerConnection = (remoteSocketId: string, remoteUserId: string, remoteUserName: string) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', {
          meetingId: id,
          candidate: event.candidate,
          toSocketId: remoteSocketId,
          fromSocketId: socketRef.current?.id
        });
      }
    };

    // Remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemoteStreams(prev => {
          const exists = prev.find(s => s.userId === remoteSocketId);
          if (exists) {
            return prev.map(s => s.userId === remoteSocketId
              ? { ...s, stream: remoteStream }
              : s
            );
          }
          return [...prev, {
            userId: remoteSocketId,
            userName: remoteUserName,
            stream: remoteStream
          }];
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setRemoteStreams(prev => prev.filter(s => s.userId !== remoteSocketId));
        peerConnectionsRef.current.delete(remoteSocketId);
      }
    };

    peerConnectionsRef.current.set(remoteSocketId, pc);
    return pc;
  };

  const makeOffer = async (remoteSocketId: string, remoteUserId: string, remoteUserName: string) => {
    const pc = createPeerConnection(remoteSocketId, remoteUserId, remoteUserName);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc-offer', {
        meetingId: id,
        offer,
        toSocketId: remoteSocketId,
        fromSocketId: socketRef.current?.id,
        fromUserId: user?.id,
        fromUserName: user?.name
      });
    } catch (err) {
      console.error('Offer error:', err);
    }
  };

  // ==================== SOCKET SETUP ====================
  const setupSocket = (autoJoin: boolean) => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected:', socketRef.current?.id);
      if (autoJoin) {
        joinMeetingRoom();
      }
    });

    // Meeting events
    socketRef.current.on('user-joined', async ({ userId, userName, socketId }) => {
      addSystemMsg(`${userName} joined`);
      // Initiate WebRTC offer to new participant
      if (socketId !== socketRef.current?.id) {
        setTimeout(() => makeOffer(socketId, userId, userName), 500);
      }
    });

    socketRef.current.on('user-left', ({ userName, socketId }) => {
      addSystemMsg(`${userName} left`);
      setRemoteStreams(prev => prev.filter(s => s.userId !== socketId));
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) { pc.close(); peerConnectionsRef.current.delete(socketId); }
    });

    socketRef.current.on('participants-list', setParticipants);

    // WebRTC events
    socketRef.current.on('webrtc-offer', async ({ offer, fromSocketId, fromUserId, fromUserName }) => {
      const pc = createPeerConnection(fromSocketId, fromUserId, fromUserName);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('webrtc-answer', {
          meetingId: id,
          answer,
          toSocketId: fromSocketId,
          fromSocketId: socketRef.current?.id,
          fromUserId: user?.id,
          fromUserName: user?.name
        });
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    socketRef.current.on('webrtc-answer', async ({ answer, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Set remote desc error:', err);
        }
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('ICE candidate error:', err);
        }
      }
    });

    // Chat
    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', setMessages);
    socketRef.current.on('user-typing', ({ userName }) => { setTypingUser(userName); setIsTyping(true); });
    socketRef.current.on('user-stop-typing', () => { setIsTyping(false); setTypingUser(''); });

    // Controls
    socketRef.current.on('hand-raised', ({ userName }) => {
      showToast(`✋ ${userName} raised their hand`);
    });
    socketRef.current.on('user-screen-sharing', ({ userName }) => {
      showToast(`🖥️ ${userName} started screen sharing`);
    });
    socketRef.current.on('user-screen-share-stopped', () => {
      showToast('🖥️ Screen sharing stopped');
    });
    socketRef.current.on('receive-caption', ({ userName, text }) => {
      setCaptionText(`${userName}: ${text}`);
      setTimeout(() => setCaptionText(''), 4000);
    });

    // Join approval
    socketRef.current.on('join-request', (req) => {
      setJoinRequests(prev => [...prev, req]);
    });
    socketRef.current.on('join-approved', () => {
      setWaitingForApproval(false);
      incrementJoinCount();
      joinMeetingRoom();
    });
    socketRef.current.on('join-rejected', () => {
      setWaitingForApproval(false);
      setJoinRejected(true);
    });
    socketRef.current.on('report-submitted', () => {
      setReportSubmitted(true);
      setTimeout(() => { setShowReportModal(false); setReportSubmitted(false); }, 2000);
    });
  };

  const joinMeetingRoom = () => {
    socketRef.current?.emit('join-meeting', {
      meetingId: id,
      userId: user?.id,
      userName: user?.name,
      isHost
    });
    socketRef.current?.emit('get-messages', { meetingId: id });
  };

  const requestApproval = () => {
    socketRef.current?.emit('request-join', {
      meetingId: id,
      userId: user?.id,
      userName: user?.name
    });
  };

  // ==================== CONTROLS ====================
  const toggleMute = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks();
    audioTracks?.forEach(t => t.enabled = isMuted);
    setIsMuted(!isMuted);
    socketRef.current?.emit('toggle-mute', { meetingId: id, userId: user?.id, isMuted: !isMuted });
  };

  const toggleVideo = () => {
    const videoTracks = localStreamRef.current?.getVideoTracks();
    videoTracks?.forEach(t => t.enabled = isVideoOff);
    setIsVideoOff(!isVideoOff);
    socketRef.current?.emit('toggle-video', { meetingId: id, userId: user?.id, isVideoOff: !isVideoOff });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);

      // Camera wapas on karo
      setIsVideoOff(false);
      const camStream = await startLocalStream();
      if (camStream) {
        // Replace tracks in all peer connections
        peerConnectionsRef.current.forEach(async (pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          const camVideoTrack = camStream.getVideoTracks()[0];
          if (videoSender && camVideoTrack) {
            await videoSender.replaceTrack(camVideoTrack);
          }
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          const camAudioTrack = camStream.getAudioTracks()[0];
          if (audioSender && camAudioTrack) {
            await audioSender.replaceTrack(camAudioTrack);
          }
        });
      }

      socketRef.current?.emit('screen-share-stopped', { meetingId: id, userId: user?.id });
      showToast('🖥️ Screen sharing stopped — camera restored');

    } else {
      // Start screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080, frameRate: 30 },
          audio: true
        });

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        // Camera off karo (screen share ke dauran)
        setIsVideoOff(true);
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);

        // Replace video track in all peer connections with screen track
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(async (pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && screenVideoTrack) {
            await videoSender.replaceTrack(screenVideoTrack);
          }
        });

        // Show screen in local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Browser stop sharing button handle
        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };

        socketRef.current?.emit('screen-share-started', {
          meetingId: id, userId: user?.id, userName: user?.name
        });
        showToast('🖥️ Screen sharing started — camera turned off');

      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          showToast('❌ Screen share failed');
        }
      }
    }
  };

  const toggleHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    if (newState) {
      socketRef.current?.emit('raise-hand', { meetingId: id, userId: user?.id, userName: user?.name });
      showToast('✋ Hand raised');
    } else {
      socketRef.current?.emit('lower-hand', { meetingId: id, userId: user?.id });
    }
  };

  const toggleCaptions = () => {
    setCaptions(!captions);
    showToast(captions ? 'CC off' : 'Live captions on');
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send-message', {
      meetingId: id, userId: user?.id,
      userName: user?.name, message: newMessage
    });
    socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id });
    setNewMessage('');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    socketRef.current?.emit('typing', { meetingId: id, userId: user?.id, userName: user?.name });
    setTimeout(() => socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id }), 2000);
  };

  const handleLeaveMeeting = useCallback(() => {
    socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
    cleanup();
    navigate('/dashboard');
  }, [id, user, navigate]);

  const handleEndMeeting = async () => {
    try {
      socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
      cleanup();
      await endMeeting(id!);
      localStorage.removeItem(`im_join_${id}`);
      navigate('/dashboard');
    } catch { navigate('/dashboard'); }
  };

  const approveJoin = (req: any) => {
    socketRef.current?.emit('approve-join', { socketId: req.socketId, meetingId: id, userName: req.userName });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
    addSystemMsg(`${req.userName} was approved`);
  };

  const rejectJoin = (req: any) => {
    socketRef.current?.emit('reject-join', { socketId: req.socketId, userName: req.userName });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
  };

  const submitReport = () => {
    if (!reportReason.trim()) return;
    socketRef.current?.emit('report-user', {
      meetingId: id, reason: reportReason, reportedBy: user?.name
    });
  };

  const addSystemMsg = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now(), type: 'system',
      message: text, timestamp: new Date().toISOString()
    }]);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(meeting?.meetingCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ==================== REMOTE VIDEO ====================
  const RemoteVideoTile = ({ remote }: { remote: RemoteStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = remote.stream;
      }
    }, [remote.stream]);
    return (
      <div className="bg-gray-800 rounded-xl overflow-hidden relative border border-gray-700">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
          {remote.userName}
        </div>
      </div>
    );
  };

  // ==================== SCREENS ====================
  if (waitingForApproval) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <UserCheck size={32} className="text-blue-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Waiting for Approval</h2>
          <p className="text-gray-400 text-sm mb-6">Host will let you in shortly...</p>
          <div className="flex gap-1 justify-center mb-6">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm">← Back</button>
        </div>
      </div>
    );
  }

  if (joinRejected) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-red-900 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX size={32} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Request Declined</h2>
          <p className="text-gray-400 text-sm mb-6">The host declined your request.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-500 text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN UI ====================
  const totalParticipants = 1 + remoteStreams.length;

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* Toast */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-full text-sm shadow-xl border border-gray-700">
          {notification}
        </div>
      )}

      {/* Join Requests */}
      {joinRequests.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {joinRequests.map((req) => (
            <div key={req.socketId} className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-xl w-72">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                  {req.userName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{req.userName}</p>
                  <p className="text-gray-400 text-xs">wants to join</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approveJoin(req)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
                  <Check size={14} /> Accept
                </button>
                <button onClick={() => rejectJoin(req)} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Flag size={18} className="text-red-400" /> Report Issue
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            {reportSubmitted ? (
              <div className="text-center py-4">
                <Check size={32} className="text-green-400 mx-auto mb-2" />
                <p className="text-white">Report submitted!</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {['Inappropriate behavior', 'Spam or harassment', 'Unauthorized recording', 'Technical abuse', 'Other'].map(reason => (
                    <button key={reason} onClick={() => setReportReason(reason)}
                      className={`w-full text-left text-sm p-3 rounded-xl border transition ${reportReason === reason ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}>
                      {reason}
                    </button>
                  ))}
                </div>
                <button onClick={submitReport} disabled={!reportReason}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium transition">
                  Submit Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Settings size={18} className="text-blue-400" /> Meeting Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Microphone', sub: isMuted ? 'Muted' : 'Active', action: toggleMute, active: !isMuted },
                { label: 'Camera', sub: isVideoOff ? 'Off' : 'On', action: toggleVideo, active: !isVideoOff },
                { label: 'Live Captions', sub: captions ? 'On' : 'Off', action: toggleCaptions, active: captions }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-gray-400 text-xs">{item.sub}</p>
                  </div>
                  <button onClick={item.action} className={`w-11 h-6 rounded-full transition relative ${item.active ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${item.active ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              ))}
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className="text-white text-sm font-medium mb-2">Meeting Code</p>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm">{meeting?.meetingCode}</span>
                  <button onClick={copyCode}>{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}</button>
                </div>
              </div>
              {isHost && (
                <div className="p-3 bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-yellow-400 text-xs font-medium">You are the host</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🤖</div>
            <h1 className="text-white font-semibold text-sm">{meeting?.title || 'Meeting'}</h1>
            {isHost && <span className="text-xs bg-yellow-600 bg-opacity-20 text-yellow-400 px-2 py-0.5 rounded-full">Host</span>}
            {isScreenSharing && <span className="text-xs bg-blue-600 bg-opacity-20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Monitor size={10} /> Sharing</span>}
          </div>
          <button onClick={copyCode} className="hidden sm:flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition">
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {meeting?.meetingCode}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-green-400 text-xs bg-green-400 bg-opacity-10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
          <span className="text-gray-400 text-xs flex items-center gap-1">
            <Users size={12} /> {totalParticipants}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video Grid */}
        <div className="flex-1 p-3 overflow-hidden">
          <div className={`h-full grid gap-2 ${
            totalParticipants === 1 ? 'grid-cols-1' :
            totalParticipants === 2 ? 'grid-cols-2' :
            totalParticipants <= 4 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>

            {/* Local Video */}
            <div className="bg-gray-900 rounded-2xl overflow-hidden relative border border-gray-800">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {isVideoOff && !isScreenSharing && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl text-white font-bold shadow-xl">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                {isMuted && <MicOff size={11} className="text-red-400" />}
                {isHandRaised && <span>✋</span>}
                {user?.name} (You)
                {isScreenSharing && <span className="text-blue-400">• Screen</span>}
              </div>
            </div>

            {/* Remote Videos */}
            {remoteStreams.map(remote => (
              <RemoteVideoTile key={remote.userId} remote={remote} />
            ))}
          </div>

          {/* Captions */}
          {captions && captionText && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-sm text-center px-6 py-2 rounded-xl border border-gray-700 max-w-2xl">
              {captionText}
            </div>
          )}
        </div>

        {/* Chat */}
        {showChat && (
          <div className="w-72 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Chat</h2>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.type === 'system' ? (
                    <div className="text-center">
                      <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">{msg.message}</span>
                    </div>
                  ) : (
                    <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-gray-400 text-xs">{msg.userName}</span>
                        <span className="text-gray-600 text-xs">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-full break-words ${msg.userId === user?.id ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
                        {msg.message}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="text-gray-500 text-xs italic">{typingUser} typing...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input type="text" value={newMessage} onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message..."
                className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
              <button onClick={sendMessage} className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-blue-500 transition">
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Participants */}
        {showParticipants && (
          <div className="w-60 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">People ({totalParticipants})</h2>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Local user */}
              <div className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">{user?.name} (You)</p>
                  <p className="text-gray-500 text-xs">{isHost ? 'Host' : 'Participant'}</p>
                </div>
                {isMuted && <MicOff size={12} className="text-red-400" />}
              </div>
              {/* Remote participants */}
              {remoteStreams.map((remote) => (
                <div key={remote.userId} className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                    {remote.userName?.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-white text-sm">{remote.userName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-2xl mx-auto">

          {/* Left */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {isMuted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
              </div>
              <span className="text-gray-500 text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={toggleVideo} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isVideoOff ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {isVideoOff ? <VideoOff size={18} className="text-white" /> : <Video size={18} className="text-white" />}
              </div>
              <span className="text-gray-500 text-xs">{isVideoOff ? 'Start' : 'Stop'}</span>
            </button>

            <button onClick={toggleScreenShare} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {isScreenSharing ? <MonitorOff size={18} className="text-white" /> : <Monitor size={18} className="text-white" />}
              </div>
              <span className="text-gray-500 text-xs">{isScreenSharing ? 'Stop' : 'Share'}</span>
            </button>
          </div>

          {/* Center */}
          <div className="flex items-center gap-2">
            <button onClick={toggleHand} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isHandRaised ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <Hand size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">{isHandRaised ? 'Lower' : 'Raise'}</span>
            </button>

            <button onClick={() => { setShowChat(!showChat); setShowParticipants(false); setUnreadMessages(0); }} className="flex flex-col items-center gap-0.5 relative">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showChat ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <MessageSquare size={18} className="text-white" />
                {unreadMessages > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{unreadMessages}</span>
                )}
              </div>
              <span className="text-gray-500 text-xs">Chat</span>
            </button>

            <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showParticipants ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <Users size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">People</span>
            </button>

            <button onClick={toggleCaptions} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${captions ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <Captions size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">CC</span>
            </button>

            {/* More */}
            <div className="relative" ref={moreMenuRef}>
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="flex flex-col items-center gap-0.5">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showMoreMenu ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  <ChevronUp size={18} className="text-white" />
                </div>
                <span className="text-gray-500 text-xs">More</span>
              </button>
              {showMoreMenu && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden w-44 z-50">
                  <button onClick={() => { setShowSettings(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Settings size={15} className="text-blue-400" /> Settings
                  </button>
                  <button onClick={() => { setShowReportModal(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Flag size={15} className="text-red-400" /> Report abuse
                  </button>
                  <button onClick={() => { copyCode(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Copy size={15} className="text-green-400" /> Copy code
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <button onClick={handleLeaveMeeting} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition">
                <LogOut size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">Leave</span>
            </button>
            <button onClick={handleEndMeeting} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-full font-medium transition">
              <PhoneOff size={16} /> End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;