import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  LogOut, PhoneOff, Send, Users, Copy, Check, X,
  UserCheck, UserX, Hand, Monitor, MonitorOff,
  Settings, Flag, ChevronUp, Captions, Loader2,
  CheckSquare, Plus
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getMeeting, endMeeting } from '../../services/meetingService';
import { getAllTasks, createTask, updateTaskStatus } from '../../services/taskService';
import api from '../../services/api';

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
}

const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Meeting
  const [meeting, setMeeting] = useState<any>(null);
  const [, setParticipants] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);

  // Media
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  // Chat
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // UI
  const [copied, setCopied] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // AI Panel
  const [showAI, setShowAI] = useState(false);
  const [aiTab, setAiTab] = useState<'summary' | 'chat'>('summary');
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);

  // Tasks Panel
  const [showTasks, setShowTasks] = useState(false);
  const [meetingTasks, setMeetingTasks] = useState<any[]>([]);
  const [fetchingMeetingTasks, setFetchingMeetingTasks] = useState(false);
  const [showAddMeetingTask, setShowAddMeetingTask] = useState(false);
  const [addingMeetingTask, setAddingMeetingTask] = useState(false);
  const [newMeetingTask, setNewMeetingTask] = useState({ title: '', priority: 'medium', assigneeName: '' });

  // Join approval
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [joinRejected, setJoinRejected] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isScreenSharingRef = useRef(false);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Join count
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
    return () => { cleanup(); };
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
    localStreamRef.current?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    socketRef.current?.disconnect();
  };

  // ==================== MEDIA ====================
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioOnly;
        setIsVideoOff(true);
        return audioOnly;
      } catch { return null; }
    }
  };

  // ==================== FETCH ====================
  const fetchMeeting = async () => {
    try {
      const response = await getMeeting(id!);
      setMeeting(response.meeting);
      const hostId = response.meeting?.host?._id || response.meeting?.host;
      setIsHost(hostId === user?.id);
    } catch (err) { console.error('Meeting fetch failed'); }
  };

  const fetchMeetingTasks = async () => {
    if (!id) return;
    try {
      setFetchingMeetingTasks(true);
      const response = await getAllTasks({ meetingId: id });
      setMeetingTasks(response.tasks || []);
    } catch (err) {
      console.error('Failed to fetch meeting tasks');
    } finally {
      setFetchingMeetingTasks(false);
    }
  };

  // ==================== WEBRTC ====================
  const createPeerConnection = (remoteSocketId: string, _remoteUserId: string, remoteUserName: string) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Always send mic audio from the camera stream.
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack && localStreamRef.current) pc.addTrack(audioTrack, localStreamRef.current);

    // Send the SCREEN video track if a share is currently active (important for
    // participants who join mid-share), otherwise send the camera video track.
    if (isScreenSharingRef.current && screenStreamRef.current) {
      const screenVideoTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenVideoTrack) pc.addTrack(screenVideoTrack, screenStreamRef.current);
    } else {
      const cameraVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraVideoTrack && localStreamRef.current) pc.addTrack(cameraVideoTrack, localStreamRef.current);
    }

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

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemoteStreams(prev => {
          const exists = prev.find(s => s.userId === remoteSocketId);
          if (exists) return prev.map(s => s.userId === remoteSocketId ? { ...s, stream: remoteStream } : s);
          return [...prev, { userId: remoteSocketId, userName: remoteUserName, stream: remoteStream }];
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
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc-offer', {
        meetingId: id, offer,
        toSocketId: remoteSocketId,
        fromSocketId: socketRef.current?.id,
        fromUserId: user?.id,
        fromUserName: user?.name
      });
    } catch (err) { console.error('Offer error:', err); }
  };

  // ==================== SOCKET ====================
  const setupSocket = (autoJoin: boolean) => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true
    });

    socketRef.current.on('connect', () => {
      if (autoJoin) joinMeetingRoom();
    });

    socketRef.current.on('user-joined', async ({ userId, userName, socketId }) => {
      addSystemMsg(`${userName} joined`);
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

    socketRef.current.on('webrtc-offer', async ({ offer, fromSocketId, fromUserId, fromUserName }) => {
      const pc = createPeerConnection(fromSocketId, fromUserId, fromUserName);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('webrtc-answer', {
          meetingId: id, answer,
          toSocketId: fromSocketId,
          fromSocketId: socketRef.current?.id,
          fromUserId: user?.id,
          fromUserName: user?.name
        });
      } catch (err) { console.error('Answer error:', err); }
    });

    socketRef.current.on('webrtc-answer', async ({ answer, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.signalingState !== 'stable') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
        catch (err) { console.error('Set remote desc error:', err); }
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (err) { console.error('ICE error:', err); }
      }
    });

    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', setMessages);
    socketRef.current.on('user-typing', ({ userName }) => { setTypingUser(userName); setIsTyping(true); });
    socketRef.current.on('user-stop-typing', () => { setIsTyping(false); setTypingUser(''); });
    socketRef.current.on('hand-raised', ({ userName }) => showToast(`✋ ${userName} raised their hand`));
    socketRef.current.on('user-screen-sharing', ({ userName }) => showToast(`🖥️ ${userName} started screen sharing`));
    socketRef.current.on('user-screen-share-stopped', () => showToast('🖥️ Screen sharing stopped'));
    socketRef.current.on('receive-caption', ({ userName, text }) => {
      setCaptionText(`${userName}: ${text}`);
      setTimeout(() => setCaptionText(''), 4000);
    });
    socketRef.current.on('join-request', (req) => setJoinRequests(prev => [...prev, req]));
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
      meetingId: id, userId: user?.id,
      userName: user?.name, isHost
    });
    socketRef.current?.emit('get-messages', { meetingId: id });
  };

  const requestApproval = () => {
    socketRef.current?.emit('request-join', {
      meetingId: id, userId: user?.id, userName: user?.name
    });
  };

  // ==================== CONTROLS ====================
  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = isMuted);
    setIsMuted(!isMuted);
    socketRef.current?.emit('toggle-mute', { meetingId: id, userId: user?.id, isMuted: !isMuted });
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = isVideoOff);
    setIsVideoOff(!isVideoOff);
    socketRef.current?.emit('toggle-video', { meetingId: id, userId: user?.id, isVideoOff: !isVideoOff });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      isScreenSharingRef.current = false;
      setIsScreenSharing(false);
      setIsVideoOff(false);
      const camStream = await startLocalStream();
      if (camStream) {
        peerConnectionsRef.current.forEach(async (pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          const camVideoTrack = camStream.getVideoTracks()[0];
          if (videoSender && camVideoTrack) await videoSender.replaceTrack(camVideoTrack);
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          const camAudioTrack = camStream.getAudioTracks()[0];
          if (audioSender && camAudioTrack) await audioSender.replaceTrack(camAudioTrack);
        });
      }
      socketRef.current?.emit('screen-share-stopped', { meetingId: id, userId: user?.id });
      showToast('🖥️ Screen sharing stopped — camera restored');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080, frameRate: 30 } as any,
          audio: true
        });
        screenStreamRef.current = screenStream;
        isScreenSharingRef.current = true;
        setIsScreenSharing(true);
        setIsVideoOff(true);
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(async (pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && screenVideoTrack) await videoSender.replaceTrack(screenVideoTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenVideoTrack.onended = () => toggleScreenShare();
        socketRef.current?.emit('screen-share-started', { meetingId: id, userId: user?.id, userName: user?.name });
        showToast('🖥️ Screen sharing started');
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') showToast('❌ Screen share failed');
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
    socketRef.current?.emit('report-user', { meetingId: id, reason: reportReason, reportedBy: user?.name });
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

  // ==================== AI FUNCTIONS ====================
  const generateAISummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const chatContext = messages
        .filter(m => m.type !== 'system')
        .map(m => `${m.userName}: ${m.message}`)
        .join('\n');

      const transcriptToUse = aiTranscript.trim() || chatContext;

      if (!transcriptToUse) {
        setAiSummary({ error: 'No content to analyze. Add transcript or send chat messages first.' });
        return;
      }

      const response = await api.post('/ai/summary', {
        transcript: transcriptToUse,
        meetingId: id
      });

      if (response.data.success) {
        setAiSummary(response.data);
      }
    } catch (err: any) {
      setAiSummary({ error: err.response?.data?.message || 'AI error occurred. Check API key.' });
    } finally {
      setAiLoading(false);
    }
  };

  const askAIQuestion = async () => {
    if (!aiQuestion.trim()) return;
    setAiChatLoading(true);
    try {
      const chatContext = messages
        .filter(m => m.type !== 'system')
        .map(m => `${m.userName}: ${m.message}`)
        .join('\n');

      const response = await api.post('/ai/chat', {
        question: aiQuestion,
        context: aiTranscript || chatContext || `Meeting: ${meeting?.title}`
      });

      if (response.data.success) {
        setAiAnswer(response.data.answer);
      }
    } catch (err) {
      setAiAnswer('AI is not available right now.');
    } finally {
      setAiChatLoading(false);
    }
  };

  // ==================== TASK FUNCTIONS ====================
  const handleAddMeetingTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTask.title.trim() || !id) return;
    setAddingMeetingTask(true);
    try {
      const response = await createTask({
        title: newMeetingTask.title.trim(),
        priority: newMeetingTask.priority,
        assigneeName: newMeetingTask.assigneeName.trim() || undefined,
        meetingId: id
      });
      setMeetingTasks(prev => [response.task, ...prev]);
      setNewMeetingTask({ title: '', priority: 'medium', assigneeName: '' });
      setShowAddMeetingTask(false);
    } catch (err) {
      console.error('Failed to add task');
    } finally {
      setAddingMeetingTask(false);
    }
  };

  const handleMeetingTaskStatusChange = async (taskId: string, newStatus: string) => {
    const prev = meetingTasks;
    setMeetingTasks(p => p.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
    try {
      const response = await updateTaskStatus(taskId, newStatus);
      setMeetingTasks(p => p.map(t => t._id === taskId ? response.task : t));
    } catch (err) {
      console.error('Failed to update task status');
      setMeetingTasks(prev);
    }
  };

  const getPriorityDot = (priority: string) => {
    if (priority === 'high') return 'bg-red-500';
    if (priority === 'low') return 'bg-gray-400';
    return 'bg-yellow-500';
  };

  const STATUS_OPTIONS = [
    { value: 'todo', label: 'Todo' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'review', label: 'Review' },
    { value: 'done', label: 'Completed' },
  ];

  // ==================== REMOTE VIDEO ====================
  const RemoteVideoTile = ({ remote }: { remote: RemoteStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (videoRef.current) videoRef.current.srcObject = remote.stream;
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

  // ==================== WAITING SCREENS ====================
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

  const totalParticipants = 1 + remoteStreams.length;

  // ==================== MAIN UI ====================
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

      {/* ===== HEADER ===== */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🤖</div>
            <h1 className="text-white font-semibold text-sm">{meeting?.title || 'Meeting'}</h1>
            {isHost && <span className="text-xs bg-yellow-600 bg-opacity-20 text-yellow-400 px-2 py-0.5 rounded-full">Host</span>}
            {isScreenSharing && <span className="text-xs bg-blue-600 bg-opacity-20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Monitor size={10} /> Sharing</span>}
          </div>

          {/* Meeting Code */}
          <button onClick={copyCode} className="hidden sm:flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition">
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {meeting?.meetingCode}
          </button>

          {/* Tasks Button */}
          <button
            onClick={() => {
              const opening = !showTasks;
              setShowTasks(opening);
              setShowChat(false);
              setShowParticipants(false);
              setShowAI(false);
              if (opening) fetchMeetingTasks();
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition font-medium ${
              showTasks
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-green-400 border border-green-800'
            }`}
          >
            <CheckSquare size={13} /> Tasks
            {meetingTasks.length > 0 && (
              <span className="bg-black bg-opacity-30 px-1.5 rounded-full text-xs">{meetingTasks.length}</span>
            )}
          </button>

          {/* AI Button */}
          <button
            onClick={() => {
              setShowAI(!showAI);
              setShowChat(false);
              setShowParticipants(false);
              setShowTasks(false);
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition font-medium ${
              showAI
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-purple-400 border border-purple-800'
            }`}
          >
            🤖 AI
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

      {/* ===== MAIN ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video Grid */}
        <div className="flex-1 p-3 overflow-hidden relative">
          <div className={`h-full grid gap-2 ${
            totalParticipants === 1 ? 'grid-cols-1' :
            totalParticipants === 2 ? 'grid-cols-2' :
            totalParticipants <= 4 ? 'grid-cols-2' : 'grid-cols-3'
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-sm text-center px-6 py-2 rounded-xl border border-gray-700 max-w-2xl">
              {captionText}
            </div>
          )}
        </div>

        {/* ===== CHAT SIDEBAR ===== */}
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

        {/* ===== PARTICIPANTS SIDEBAR ===== */}
        {showParticipants && (
          <div className="w-60 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">People ({totalParticipants})</h2>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
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

        {/* ===== TASKS SIDEBAR ===== */}
        {showTasks && (
          <div className="w-80 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <CheckSquare size={16} className="text-green-400" /> Meeting Tasks
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMeetingTask(!showAddMeetingTask)}
                  className="w-7 h-7 bg-green-600 hover:bg-green-500 rounded-lg flex items-center justify-center transition"
                  title="Add task"
                >
                  <Plus size={14} className="text-white" />
                </button>
                <button onClick={() => setShowTasks(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
              </div>
            </div>

            {/* Quick Add Task Form */}
            {showAddMeetingTask && (
              <form onSubmit={handleAddMeetingTask} className="p-3 border-b border-gray-800 space-y-2 bg-gray-850">
                <input
                  type="text"
                  required
                  value={newMeetingTask.title}
                  onChange={(e) => setNewMeetingTask({ ...newMeetingTask, title: e.target.value })}
                  placeholder="Task title..."
                  className="w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500 border border-gray-700"
                />
                <div className="flex gap-2">
                  <select
                    value={newMeetingTask.priority}
                    onChange={(e) => setNewMeetingTask({ ...newMeetingTask, priority: e.target.value })}
                    className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <input
                    type="text"
                    value={newMeetingTask.assigneeName}
                    onChange={(e) => setNewMeetingTask({ ...newMeetingTask, assigneeName: e.target.value })}
                    placeholder="Assignee"
                    className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500 border border-gray-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingMeetingTask || !newMeetingTask.title.trim()}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5"
                >
                  {addingMeetingTask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add Task
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {fetchingMeetingTasks ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-green-500" />
                </div>
              ) : meetingTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare size={28} className="mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-500 text-xs">No tasks linked to this meeting yet</p>
                </div>
              ) : (
                meetingTasks.map((task: any) => (
                  <div key={task._id} className="p-3 bg-gray-800 rounded-xl border border-gray-700">
                    <p className="text-white text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${getPriorityDot(task.priority)}`}></span>
                      <span className="text-gray-400 text-xs">{task.assigneeName || 'Unassigned'}</span>
                    </div>
                    <select
                      value={task.status}
                      onChange={(e) => handleMeetingTaskStatusChange(task._id, e.target.value)}
                      className="mt-2 w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===== AI PANEL ===== */}
        {showAI && (
          <div className="w-80 bg-gray-900 flex flex-col border-l border-gray-800">

            {/* AI Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                🤖 AI Assistant
              </h2>
              <button onClick={() => setShowAI(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>

            {/* AI Tabs */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setAiTab('summary')}
                className={`flex-1 py-2.5 text-xs font-medium transition border-b-2 ${
                  aiTab === 'summary'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-purple-400'
                }`}
              >
                📋 Summary
              </button>
              <button
                onClick={() => setAiTab('chat')}
                className={`flex-1 py-2.5 text-xs font-medium transition border-b-2 ${
                  aiTab === 'chat'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-purple-400'
                }`}
              >
                💬 Ask AI
              </button>
            </div>

            {/* Summary Tab */}
            {aiTab === 'summary' && (
              <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-3">
                <p className="text-gray-400 text-xs">
                  Paste transcript below, or leave empty to use chat messages automatically.
                </p>
                <textarea
                  value={aiTranscript}
                  onChange={(e) => setAiTranscript(e.target.value)}
                  placeholder="Paste transcript here... (optional)"
                  rows={4}
                  className="w-full bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 resize-none border border-gray-700"
                />
                <button
                  onClick={generateAISummary}
                  disabled={aiLoading}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {aiLoading
                    ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                    : <>🧠 Generate Summary</>
                  }
                </button>

                {/* AI Results */}
                {aiSummary && (
                  <div className="space-y-3">
                    {aiSummary.error ? (
                      <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-400 p-3 rounded-xl text-xs">
                        ⚠️ {aiSummary.error}
                      </div>
                    ) : (
                      <>
                        {aiSummary.summary && (
                          <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-purple-400 text-xs font-medium mb-1">📄 Summary</p>
                            <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.summary}</p>
                          </div>
                        )}
                        {aiSummary.keyPoints?.length > 0 && (
                          <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-purple-400 text-xs font-medium mb-2">🎯 Key Points</p>
                            <ul className="space-y-1">
                              {aiSummary.keyPoints.map((point: string, i: number) => (
                                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                                  <span className="text-purple-400 mt-0.5">•</span> {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {aiSummary.actionItems?.length > 0 && (
                          <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-purple-400 text-xs font-medium mb-2">✅ Action Items</p>
                            <ul className="space-y-2">
                              {aiSummary.actionItems.map((item: any, i: number) => (
                                <li key={i} className="text-xs border-l-2 border-purple-700 pl-2">
                                  <p className="text-white">{item.task}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {item.owner && <span className="text-gray-400">👤 {item.owner}</span>}
                                    {item.deadline && <span className="text-gray-400">📅 {item.deadline}</span>}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      item.priority === 'high' ? 'bg-red-900 text-red-300' :
                                      item.priority === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                                      'bg-green-900 text-green-300'
                                    }`}>{item.priority}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {aiSummary.decisions?.length > 0 && (
                          <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-purple-400 text-xs font-medium mb-2">🔖 Decisions</p>
                            <ul className="space-y-1">
                              {aiSummary.decisions.map((d: string, i: number) => (
                                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                                  <span className="text-green-400">✓</span> {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ask AI Tab */}
            {aiTab === 'chat' && (
              <div className="flex-1 flex flex-col p-4 gap-3">
                <p className="text-gray-400 text-xs">Ask anything about the meeting</p>

                {/* Quick questions */}
                <div className="flex flex-wrap gap-1.5">
                  {['What was decided?', 'List action items', 'Key points?', 'Next steps?'].map(q => (
                    <button
                      key={q}
                      onClick={() => setAiQuestion(q)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-400 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* AI Answer */}
                {aiAnswer && (
                  <div className="bg-purple-900 bg-opacity-30 border border-purple-800 rounded-xl p-3 flex-1 overflow-y-auto">
                    <p className="text-purple-400 text-xs font-medium mb-1">🤖 AI Answer</p>
                    <p className="text-gray-300 text-xs leading-relaxed">{aiAnswer}</p>
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && askAIQuestion()}
                    placeholder="Ask AI about this meeting..."
                    className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 border border-gray-700"
                  />
                  <button
                    onClick={askAIQuestion}
                    disabled={aiChatLoading || !aiQuestion.trim()}
                    className="w-9 h-9 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition"
                  >
                    {aiChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CONTROLS ===== */}
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

            <button onClick={() => { setShowChat(!showChat); setShowParticipants(false); setShowAI(false); setShowTasks(false); setUnreadMessages(0); }} className="flex flex-col items-center gap-0.5 relative">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showChat ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <MessageSquare size={18} className="text-white" />
                {unreadMessages > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{unreadMessages}</span>
                )}
              </div>
              <span className="text-gray-500 text-xs">Chat</span>
            </button>

            <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowAI(false); setShowTasks(false); }} className="flex flex-col items-center gap-0.5">
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