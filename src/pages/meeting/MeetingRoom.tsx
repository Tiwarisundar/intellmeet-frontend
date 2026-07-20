import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  LogOut, PhoneOff, Send, Users, Copy, Check, X,
  UserCheck, UserX, Hand, Monitor, MonitorOff,
  Settings, Flag, ChevronUp, Loader2,
  CheckSquare, Plus, Volume2, VolumeX,
  Smartphone, Captions, MoreHorizontal, Smile
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
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉', '😮'];

interface RemoteStream { userId: string; userName: string; stream: MediaStream; }
interface FloatingReaction { id: number; emoji: string; }

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
  const [isSoundOff, setIsSoundOff] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  // Chat
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Panels
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Controls
  const [copied, setCopied] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [captions, setCaptions] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Reactions (Google Meet style floating emojis)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // On-the-go mode (mobile portrait layout)
  const [onTheGo, setOnTheGo] = useState(false);

  // Report
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // AI
  const [aiTab, setAiTab] = useState<'summary' | 'chat'>('summary');
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);

  // Tasks
  const [meetingTasks, setMeetingTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', assigneeName: '' });

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
  const emojiMenuRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Helpers
  // Forces the <video> element to actually re-render the stream — some browsers
  // silently no-op when srcObject is reassigned to the SAME MediaStream reference
  // (e.g. after adding a track to an already-attached stream), leaving the local
  // preview blank even though the track itself is live.
  const attachStream = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!el) return;
    el.srcObject = null;
    if (stream) {
      el.srcObject = stream;
      el.play?.().catch(() => {});
    }
  };

  const getJoinCount = () => parseInt(localStorage.getItem(`im_join_${id}`) || '0');
  const incrementJoinCount = () => {
    const c = getJoinCount() + 1;
    localStorage.setItem(`im_join_${id}`, c.toString());
    return c;
  };
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };
  const closeAllPanels = () => {
    setShowChat(false); setShowParticipants(false);
    setShowAI(false); setShowTasks(false);
  };

  // ==================== SETUP ====================
  useEffect(() => {
    fetchMeeting();
    startLocalStream().then(() => {
      const count = getJoinCount();
      if (count >= MAX_FREE_JOINS) {
        setWaitingForApproval(true);
        setupSocket(false);
        setTimeout(requestApproval, 1200);
      } else {
        incrementJoinCount();
        setupSocket(true);
      }
    });
    return () => cleanup();
  }, [id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!showChat) setUnreadMessages(prev => prev + 1);
    else setUnreadMessages(0);
  }, [messages.length]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node))
        setShowMoreMenu(false);
      if (emojiMenuRef.current && !emojiMenuRef.current.contains(e.target as Node))
        setShowEmojiPicker(false);
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
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });
      localStreamRef.current = stream;
      attachStream(localVideoRef.current, stream);
      return stream;
    } catch {
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audio;
        setIsVideoOff(true);
        showToast('⚠️ Camera not available — joined with audio only. Tap camera icon to retry.');
        return audio;
      } catch {
        showToast('❌ Camera & mic permission denied — enable them in browser settings');
        return null;
      }
    }
  };

  // ==================== FETCH ====================
  const fetchMeeting = async () => {
    try {
      const res = await getMeeting(id!);
      setMeeting(res.meeting);
      const hostId = res.meeting?.host?._id || res.meeting?.host;
      setIsHost(hostId === user?.id);
    } catch { console.error('Meeting fetch failed'); }
  };

  const fetchMeetingTasks = async () => {
    if (!id) return;
    setFetchingTasks(true);
    try {
      const res = await getAllTasks({ meetingId: id });
      setMeetingTasks(res.tasks || []);
    } catch { console.error('Tasks fetch failed'); }
    finally { setFetchingTasks(false); }
  };

  // ==================== WEBRTC ====================
  const createPeerConnection = (remoteSocketId: string, _uid: string, remoteUserName: string) => {
    if (peerConnectionsRef.current.has(remoteSocketId))
      return peerConnectionsRef.current.get(remoteSocketId)!;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack && localStreamRef.current) pc.addTrack(audioTrack, localStreamRef.current);

    if (isScreenSharingRef.current && screenStreamRef.current) {
      const svt = screenStreamRef.current.getVideoTracks()[0];
      if (svt) pc.addTrack(svt, screenStreamRef.current);
    } else {
      const cvt = localStreamRef.current?.getVideoTracks()[0];
      if (cvt && localStreamRef.current) pc.addTrack(cvt, localStreamRef.current);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate)
        socketRef.current?.emit('ice-candidate', {
          meetingId: id, candidate: e.candidate,
          toSocketId: remoteSocketId, fromSocketId: socketRef.current?.id
        });
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream)
        setRemoteStreams(prev => {
          const exists = prev.find(s => s.userId === remoteSocketId);
          if (exists) return prev.map(s => s.userId === remoteSocketId ? { ...s, stream } : s);
          return [...prev, { userId: remoteSocketId, userName: remoteUserName, stream }];
        });
    };

    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'failed'].includes(pc.iceConnectionState)) {
        setRemoteStreams(prev => prev.filter(s => s.userId !== remoteSocketId));
        peerConnectionsRef.current.delete(remoteSocketId);
      }
    };

    peerConnectionsRef.current.set(remoteSocketId, pc);
    return pc;
  };

  const makeOffer = async (rSid: string, rUid: string, rUname: string) => {
    const pc = createPeerConnection(rSid, rUid, rUname);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc-offer', {
        meetingId: id, offer, toSocketId: rSid,
        fromSocketId: socketRef.current?.id, fromUserId: user?.id, fromUserName: user?.name
      });
    } catch (e) { console.error('Offer error:', e); }
  };

  // ==================== SOCKET ====================
  const setupSocket = (autoJoin: boolean) => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token }, transports: ['websocket'], reconnection: true
    });

    socketRef.current.on('connect', () => { if (autoJoin) joinMeetingRoom(); });

    socketRef.current.on('user-joined', ({ userId, userName, socketId }) => {
      addSystemMsg(`${userName} joined the meeting`);
      if (socketId !== socketRef.current?.id)
        setTimeout(() => makeOffer(socketId, userId, userName), 500);
    });

    socketRef.current.on('user-left', ({ userName, socketId }) => {
      addSystemMsg(`${userName} left the meeting`);
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
          meetingId: id, answer, toSocketId: fromSocketId,
          fromSocketId: socketRef.current?.id, fromUserId: user?.id, fromUserName: user?.name
        });
      } catch (e) { console.error('Answer error:', e); }
    });

    socketRef.current.on('webrtc-answer', async ({ answer, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.signalingState !== 'stable')
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
        catch (e) { console.error('Remote desc error:', e); }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, fromSocketId }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && candidate)
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.error('ICE error:', e); }
    });

    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', setMessages);
    socketRef.current.on('user-typing', ({ userName }) => { setTypingUser(userName); setIsTyping(true); });
    socketRef.current.on('user-stop-typing', () => { setIsTyping(false); setTypingUser(''); });

    socketRef.current.on('hand-raised', ({ userId, userName }) => {
      setRaisedHands(prev => [...new Set([...prev, userId])]);
      showToast(`✋ ${userName} raised their hand`);
    });
    socketRef.current.on('hand-lowered', ({ userId }) => {
      setRaisedHands(prev => prev.filter(i => i !== userId));
    });
    socketRef.current.on('user-screen-sharing', ({ userName }) => showToast(`🖥️ ${userName} is sharing screen`));
    socketRef.current.on('user-screen-share-stopped', () => showToast('🖥️ Screen sharing stopped'));
    socketRef.current.on('receive-caption', ({ userName, text }) => {
      setCaptionText(`${userName}: ${text}`);
      setTimeout(() => setCaptionText(''), 4500);
    });

    // Reactions (Google Meet style floating emojis)
    socketRef.current.on('receive-reaction', ({ emoji }) => {
      spawnFloatingReaction(emoji);
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
      meetingId: id, userId: user?.id, userName: user?.name, isHost
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
    showToast(isMuted ? '🎤 Microphone on' : '🔇 Microphone muted');
  };

  // Fixed: if no video track exists yet (initial getUserMedia video failed),
  // request camera fresh instead of silently no-op'ing on an empty track list.
  const toggleVideo = async () => {
    const existingTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!existingTrack) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }
        });
        const newTrack = camStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = camStream;
        } else {
          localStreamRef.current.addTrack(newTrack);
        }
        attachStream(localVideoRef.current, localStreamRef.current);

        peerConnectionsRef.current.forEach(async (pc) => {
          const sender = pc.getSenders().find(s => s.track === null || s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newTrack);
          else pc.addTrack(newTrack, localStreamRef.current!);
        });

        setIsVideoOff(false);
        socketRef.current?.emit('toggle-video', { meetingId: id, userId: user?.id, isVideoOff: false });
        showToast('📷 Camera on');
      } catch (e) {
        console.error('Camera enable error:', e);
        showToast('❌ Camera permission denied — check browser site settings');
      }
      return;
    }

    existingTrack.enabled = isVideoOff;
    setIsVideoOff(!isVideoOff);
    socketRef.current?.emit('toggle-video', { meetingId: id, userId: user?.id, isVideoOff: !isVideoOff });
    showToast(isVideoOff ? '📷 Camera on' : '📷 Camera off');
  };

  const toggleSound = () => {
    const newState = !isSoundOff;
    setIsSoundOff(newState);
    // Mute all remote video elements
    remoteVideoRefs.current.forEach(v => { v.muted = newState; });
    showToast(newState ? '🔇 Speaker muted' : '🔊 Speaker on');
  };

  // Fixed: added device/browser support check + clearer error surfacing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      isScreenSharingRef.current = false;
      setIsScreenSharing(false);
      setIsVideoOff(false);
      const cam = await startLocalStream();
      if (cam) {
        peerConnectionsRef.current.forEach(async (pc) => {
          const senders = pc.getSenders();
          const vs = senders.find(s => s.track?.kind === 'video');
          const as = senders.find(s => s.track?.kind === 'audio');
          if (vs && cam.getVideoTracks()[0]) await vs.replaceTrack(cam.getVideoTracks()[0]);
          if (as && cam.getAudioTracks()[0]) await as.replaceTrack(cam.getAudioTracks()[0]);
        });
      }
      socketRef.current?.emit('screen-share-stopped', { meetingId: id, userId: user?.id });
      showToast('🖥️ Screen share stopped — camera restored');
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('❌ Screen share not supported in this browser');
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 } as any,
        audio: true
      });
      screenStreamRef.current = screen;
      isScreenSharingRef.current = true;
      setIsScreenSharing(true);
      setIsVideoOff(true);
      localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);
      const svt = screen.getVideoTracks()[0];
      peerConnectionsRef.current.forEach(async (pc) => {
        const vs = pc.getSenders().find(s => s.track?.kind === 'video');
        if (vs && svt) await vs.replaceTrack(svt);
        else if (svt) pc.addTrack(svt, screen);
      });
      attachStream(localVideoRef.current, screen);
      svt.onended = () => toggleScreenShare();
      socketRef.current?.emit('screen-share-started', { meetingId: id, userId: user?.id, userName: user?.name });
      showToast('🖥️ Screen sharing started');
    } catch (e: any) {
      console.error('Screen share error:', e);
      if (e.name === 'NotAllowedError') showToast('Screen share cancelled');
      else showToast(`❌ Screen share failed: ${e.name || 'unknown error'}`);
    }
  };

  const toggleHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (next) {
      socketRef.current?.emit('raise-hand', { meetingId: id, userId: user?.id, userName: user?.name });
      showToast('✋ Hand raised — host can see');
    } else {
      socketRef.current?.emit('lower-hand', { meetingId: id, userId: user?.id });
      showToast('Hand lowered');
    }
  };

  const toggleCaptions = () => {
    setCaptions(!captions);
    showToast(captions ? 'CC off' : '💬 Live captions on');
  };

  // ==================== REACTIONS ====================
  const spawnFloatingReaction = (emoji: string) => {
    const rid = Date.now() + Math.random();
    setFloatingReactions(prev => [...prev, { id: rid, emoji }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rid)), 2500);
  };

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit('send-reaction', {
      meetingId: id, emoji, userId: user?.id, userName: user?.name
    });
    spawnFloatingReaction(emoji);
    setShowEmojiPicker(false);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send-message', {
      meetingId: id, userId: user?.id, userName: user?.name, message: newMessage
    });
    if (captions)
      socketRef.current?.emit('caption-text', {
        meetingId: id, userId: user?.id, userName: user?.name, text: newMessage
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
    socketRef.current?.emit('approve-join', { socketId: req.socketId, meetingId: id });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
    addSystemMsg(`${req.userName} was approved to join`);
  };

  const rejectJoin = (req: any) => {
    socketRef.current?.emit('reject-join', { socketId: req.socketId, userName: req.userName });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
  };

  const submitReport = () => {
    if (!reportReason) return;
    socketRef.current?.emit('report-user', {
      meetingId: id, reason: reportReason, reportedBy: user?.name
    });
  };

  const addSystemMsg = (text: string) =>
    setMessages(prev => [...prev, {
      id: Date.now(), type: 'system',
      message: text, timestamp: new Date().toISOString()
    }]);

  const copyCode = () => {
    navigator.clipboard.writeText(meeting?.meetingCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('📋 Meeting code copied!');
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ==================== AI ====================
  const generateAISummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const chatCtx = messages
        .filter(m => m.type !== 'system')
        .map(m => `${m.userName}: ${m.message}`)
        .join('\n');
      const txt = aiTranscript.trim() || chatCtx;
      if (!txt) { setAiSummary({ error: 'No content to analyze. Add transcript or use chat first.' }); return; }
      const res = await api.post('/ai/summary', { transcript: txt, meetingId: id });
      if (res.data.success) setAiSummary(res.data);
    } catch (e: any) {
      setAiSummary({ error: e.response?.data?.message || 'AI error. Check your API key.' });
    } finally { setAiLoading(false); }
  };

  const askAIQuestion = async () => {
    if (!aiQuestion.trim()) return;
    setAiChatLoading(true);
    try {
      const chatCtx = messages.filter(m => m.type !== 'system').map(m => `${m.userName}: ${m.message}`).join('\n');
      const res = await api.post('/ai/chat', {
        question: aiQuestion,
        context: aiTranscript || chatCtx || meeting?.title
      });
      if (res.data.success) setAiAnswer(res.data.answer);
    } catch { setAiAnswer('AI is not available right now.'); }
    finally { setAiChatLoading(false); }
  };

  // ==================== TASKS ====================
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !id) return;
    setAddingTask(true);
    try {
      const res = await createTask({
        title: newTask.title.trim(),
        priority: newTask.priority,
        assigneeName: newTask.assigneeName.trim() || undefined,
        meetingId: id
      });
      setMeetingTasks(prev => [res.task, ...prev]);
      setNewTask({ title: '', priority: 'medium', assigneeName: '' });
      setShowAddTask(false);
      showToast('✅ Task added!');
    } catch { console.error('Task add failed'); }
    finally { setAddingTask(false); }
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    const prev = meetingTasks;
    setMeetingTasks(p => p.map(t => t._id === taskId ? { ...t, status } : t));
    try {
      const res = await updateTaskStatus(taskId, status);
      setMeetingTasks(p => p.map(t => t._id === taskId ? res.task : t));
    } catch { setMeetingTasks(prev); }
  };

  // ==================== REMOTE VIDEO ====================
  const RemoteVideoTile = ({ remote }: { remote: RemoteStream }) => {
    const vRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (vRef.current) {
        vRef.current.srcObject = remote.stream;
        vRef.current.muted = isSoundOff;
        remoteVideoRefs.current.set(remote.userId, vRef.current);
      }
      return () => { remoteVideoRefs.current.delete(remote.userId); };
    }, [remote.stream]);
    return (
      <div className="bg-gray-800 rounded-xl overflow-hidden relative border border-gray-700 aspect-video">
        <video ref={vRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 max-w-[80%] truncate">
          {raisedHands.includes(remote.userId) && <span>✋</span>}
          <span className="truncate">{remote.userName}</span>
        </div>
      </div>
    );
  };

  const totalParticipants = 1 + remoteStreams.length;
  const anyPanelOpen = showChat || showParticipants || showAI || showTasks;

  // ==================== WAITING SCREENS ====================
  if (waitingForApproval) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-blue-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <UserCheck size={32} className="text-blue-400" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Waiting for Approval</h2>
        <p className="text-gray-400 text-sm mb-6">The host will let you in shortly...</p>
        <div className="flex gap-1 justify-center mb-6">
          {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />)}
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm">← Back to Dashboard</button>
      </div>
    </div>
  );

  if (joinRejected) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-red-900 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserX size={32} className="text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Request Declined</h2>
        <p className="text-gray-400 text-sm mb-6">The host declined your join request.</p>
        <button onClick={() => navigate('/dashboard')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-500 text-sm font-medium">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ==================== MAIN UI ====================
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden select-none">

      {/* ===== TOAST ===== */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] bg-gray-800 text-white px-4 py-2 rounded-full text-xs sm:text-sm shadow-xl border border-gray-700 max-w-[85vw] sm:max-w-md text-center pointer-events-none">
          {notification}
        </div>
      )}

      {/* ===== JOIN REQUESTS ===== */}
      {joinRequests.length > 0 && (
        <div className="fixed top-16 right-2 sm:right-4 z-50 space-y-2 max-w-[calc(100vw-1rem)] sm:max-w-xs">
          {joinRequests.map(req => (
            <div key={req.socketId} className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-xl w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                  {req.userName?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{req.userName}</p>
                  <p className="text-gray-400 text-xs">wants to join</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approveJoin(req)} className="flex-1 bg-green-600 hover:bg-green-500 active:scale-95 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
                  <Check size={13} /> Accept
                </button>
                <button onClick={() => rejectJoin(req)} className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
                  <X size={13} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== REPORT MODAL ===== */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Flag size={18} className="text-red-400" /> Report Issue
              </h3>
              <button onClick={() => { setShowReportModal(false); setReportReason(''); }} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            {reportSubmitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={24} className="text-green-400" />
                </div>
                <p className="text-white font-medium">Report submitted!</p>
                <p className="text-gray-400 text-sm mt-1">Thank you for helping keep meetings safe.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {['Inappropriate behavior', 'Spam or harassment', 'Unauthorized recording', 'Technical abuse', 'Other'].map(r => (
                    <button key={r} onClick={() => setReportReason(r)}
                      className={`w-full text-left text-sm p-3 rounded-xl border transition active:scale-[0.99] ${
                        reportReason === r
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
                <button onClick={submitReport} disabled={!reportReason}
                  className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.99] disabled:opacity-50 text-white py-3 rounded-xl font-medium transition">
                  Submit Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== SETTINGS MODAL ===== */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Settings size={18} className="text-blue-400" /> Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {/* Mic */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {isMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-green-400" />}
                  <div>
                    <p className="text-white text-sm font-medium">Microphone</p>
                    <p className="text-gray-400 text-xs">{isMuted ? 'Muted' : 'Active'}</p>
                  </div>
                </div>
                <button onClick={toggleMute} className={`w-12 h-6 rounded-full transition relative ${!isMuted ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!isMuted ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Camera */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {isVideoOff ? <VideoOff size={16} className="text-red-400" /> : <Video size={16} className="text-green-400" />}
                  <div>
                    <p className="text-white text-sm font-medium">Camera</p>
                    <p className="text-gray-400 text-xs">{isVideoOff ? 'Off' : 'On'}</p>
                  </div>
                </div>
                <button onClick={toggleVideo} className={`w-12 h-6 rounded-full transition relative ${!isVideoOff ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!isVideoOff ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Speaker */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {isSoundOff ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-green-400" />}
                  <div>
                    <p className="text-white text-sm font-medium">Speaker</p>
                    <p className="text-gray-400 text-xs">{isSoundOff ? 'Muted' : 'Active'}</p>
                  </div>
                </div>
                <button onClick={toggleSound} className={`w-12 h-6 rounded-full transition relative ${!isSoundOff ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!isSoundOff ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Captions */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Captions size={16} className={captions ? 'text-blue-400' : 'text-gray-400'} />
                  <div>
                    <p className="text-white text-sm font-medium">Live Captions</p>
                    <p className="text-gray-400 text-xs">{captions ? 'On' : 'Off'}</p>
                  </div>
                </div>
                <button onClick={toggleCaptions} className={`w-12 h-6 rounded-full transition relative ${captions ? 'bg-blue-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${captions ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* On-the-go */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Smartphone size={16} className={onTheGo ? 'text-orange-400' : 'text-gray-400'} />
                  <div>
                    <p className="text-white text-sm font-medium">On-the-Go Mode</p>
                    <p className="text-gray-400 text-xs">Compact mobile layout</p>
                  </div>
                </div>
                <button onClick={() => setOnTheGo(!onTheGo)} className={`w-12 h-6 rounded-full transition relative ${onTheGo ? 'bg-orange-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${onTheGo ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Meeting code */}
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-xs mb-1.5">Meeting Code</p>
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 font-mono text-sm">{meeting?.meetingCode}</span>
                  <button onClick={copyCode} className="text-gray-400 hover:text-white transition">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {isHost && (
                <div className="p-3 bg-yellow-600 bg-opacity-10 border border-yellow-800 rounded-xl flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                  <span className="text-yellow-400 text-sm font-medium">You are the host</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className={`bg-gray-900 border-b border-gray-800 flex-shrink-0 ${onTheGo ? 'px-3 py-2' : 'px-3 sm:px-6 py-2.5 sm:py-3'}`}>
        <div className="flex items-center justify-between gap-2">

          {/* Left: title + badges */}
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <h1 className={`text-white font-semibold truncate max-w-[90px] sm:max-w-[220px] lg:max-w-[320px] ${onTheGo ? 'text-xs' : 'text-sm'}`}>
              {meeting?.title || 'Meeting'}
            </h1>
            {isHost && !onTheGo && (
              <span className="text-xs bg-yellow-600 bg-opacity-20 text-yellow-400 px-2 py-0.5 rounded-full flex-shrink-0">Host</span>
            )}
            {raisedHands.length > 0 && (
              <span className="text-xs bg-yellow-600 bg-opacity-20 text-yellow-300 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                ✋ {raisedHands.length}
              </span>
            )}

            {/* Code copy — hidden on tiny screens */}
            <button onClick={copyCode} className="hidden md:flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg transition flex-shrink-0">
              {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              <span>{meeting?.meetingCode}</span>
            </button>

            {/* Task button */}
            <button
              onClick={() => { const o = !showTasks; closeAllPanels(); setShowTasks(o); if (o) fetchMeetingTasks(); }}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition flex-shrink-0 ${
                showTasks ? 'bg-green-600 text-white' : 'bg-gray-800 text-green-400 border border-green-900 hover:bg-gray-700'
              }`}
            >
              <CheckSquare size={12} />
              <span className="hidden sm:inline">Tasks</span>
              {meetingTasks.length > 0 && <span className="bg-black bg-opacity-30 px-1 rounded-full">{meetingTasks.length}</span>}
            </button>

            {/* AI button */}
            <button
              onClick={() => { const o = !showAI; closeAllPanels(); setShowAI(o); }}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition flex-shrink-0 ${
                showAI ? 'bg-purple-600 text-white' : 'bg-gray-800 text-purple-400 border border-purple-900 hover:bg-gray-700'
              }`}
            >
              <span>🤖</span>
              <span className="hidden sm:inline">AI</span>
            </button>
          </div>

          {/* Right: live + count */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-green-400 text-xs bg-green-400 bg-opacity-10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              {!onTheGo && <span className="hidden sm:inline">Live</span>}
            </span>
            <span className="text-gray-400 text-xs flex items-center gap-0.5">
              <Users size={11} />{totalParticipants}
            </span>
          </div>
        </div>
      </div>

      {/* ===== MAIN ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ===== VIDEO GRID ===== */}
        <div className={`flex-1 p-2 sm:p-3 lg:p-4 overflow-hidden relative ${anyPanelOpen && !onTheGo ? 'hidden sm:block' : 'block'}`}>
          {onTheGo ? (
            // On-the-go: stack vertically, compact
            <div className="h-full flex flex-col gap-2">
              <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden relative border border-gray-800">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {isVideoOff && !isScreenSharing && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-xl text-white font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  {isMuted && <MicOff size={9} className="text-red-400" />}
                  {user?.name} (You)
                </div>
              </div>
              {remoteStreams.map(r => (
                <div key={r.userId} className="flex-1 max-h-32">
                  <RemoteVideoTile remote={r} />
                </div>
              ))}
            </div>
          ) : (
            // Normal grid — scales cleanly from mobile up to large desktop
            <div className={`h-full grid gap-2 sm:gap-3 ${
              totalParticipants === 1 ? 'grid-cols-1' :
              totalParticipants === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              totalParticipants <= 4 ? 'grid-cols-2' :
              totalParticipants <= 6 ? 'grid-cols-2 sm:grid-cols-3' :
              'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            }`}>
              <div className="bg-gray-900 rounded-xl sm:rounded-2xl overflow-hidden relative border border-gray-800 aspect-video sm:aspect-auto">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {isVideoOff && !isScreenSharing && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-full flex items-center justify-center text-2xl sm:text-3xl text-white font-bold shadow-xl">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full flex items-center gap-1 max-w-[calc(100%-16px)] truncate">
                  {isMuted && <MicOff size={10} className="text-red-400 flex-shrink-0" />}
                  {isHandRaised && <span>✋</span>}
                  <span className="truncate">{user?.name} (You)</span>
                  {isScreenSharing && <span className="text-blue-400 flex-shrink-0 ml-1">• Screen</span>}
                </div>
              </div>
              {remoteStreams.map(r => (
                <div key={r.userId} className="aspect-video sm:aspect-auto">
                  <RemoteVideoTile remote={r} />
                </div>
              ))}
            </div>
          )}

          {/* Captions overlay */}
          {captions && captionText && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs sm:text-sm text-center px-4 py-2 rounded-xl border border-gray-700 max-w-[90%]">
              {captionText}
            </div>
          )}

          {/* Floating reactions (Google Meet style) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {floatingReactions.map(r => (
              <span
                key={r.id}
                className="absolute text-3xl sm:text-4xl float-emoji"
                style={{ left: `${15 + Math.random() * 70}%`, bottom: '8%' }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* ===== CHAT PANEL ===== */}
        {showChat && (
          <div className={`${onTheGo ? 'fixed inset-0 z-40' : 'fixed inset-0 sm:static sm:inset-auto z-40 sm:z-auto'} w-full sm:w-72 lg:w-80 bg-gray-900 flex flex-col sm:border-l border-gray-800`}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-400" /> Chat
                {unreadMessages > 0 && <span className="w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{unreadMessages}</span>}
              </h2>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-600 text-xs">No messages yet. Say hello! 👋</div>
              )}
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.type === 'system' ? (
                    <div className="text-center">
                      <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">{msg.message}</span>
                    </div>
                  ) : (
                    <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-gray-400 text-xs">{msg.userName}</span>
                        <span className="text-gray-600 text-[10px]">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${
                        msg.userId === user?.id
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                      }`}>{msg.message}</div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="text-gray-500 text-xs italic">{typingUser} is typing...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-gray-800 flex gap-2 flex-shrink-0">
              <input
                type="text" value={newMessage} onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Message..."
                className="flex-1 min-w-0 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
              <button onClick={sendMessage} className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-95 transition flex-shrink-0">
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ===== PARTICIPANTS PANEL ===== */}
        {showParticipants && (
          <div className={`${onTheGo ? 'fixed inset-0 z-40' : 'fixed inset-0 sm:static sm:inset-auto z-40 sm:z-auto'} w-full sm:w-60 lg:w-72 bg-gray-900 flex flex-col sm:border-l border-gray-800`}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-400" /> People ({totalParticipants})
              </h2>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Local */}
              <div className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{user?.name} (You)</p>
                  <p className="text-gray-500 text-xs">{isHost ? '👑 Host' : 'Participant'}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isMuted && <MicOff size={12} className="text-red-400" />}
                  {isHandRaised && <span className="text-sm">✋</span>}
                </div>
              </div>
              {/* Remote */}
              {remoteStreams.map(r => (
                <div key={r.userId} className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {r.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{r.userName}</p>
                    <p className="text-gray-500 text-xs">Participant</p>
                  </div>
                  {raisedHands.includes(r.userId) && <span className="text-sm">✋</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== TASKS PANEL ===== */}
        {showTasks && (
          <div className={`${onTheGo ? 'fixed inset-0 z-40' : 'fixed inset-0 sm:static sm:inset-auto z-40 sm:z-auto'} w-full sm:w-80 lg:w-96 bg-gray-900 flex flex-col sm:border-l border-gray-800`}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <CheckSquare size={16} className="text-green-400" /> Tasks
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddTask(!showAddTask)}
                  className="w-7 h-7 bg-green-600 hover:bg-green-500 active:scale-95 rounded-lg flex items-center justify-center transition">
                  <Plus size={14} className="text-white" />
                </button>
                <button onClick={() => setShowTasks(false)} className="text-gray-400 hover:text-white p-1"><X size={18} /></button>
              </div>
            </div>

            {showAddTask && (
              <form onSubmit={handleAddTask} className="p-3 border-b border-gray-800 space-y-2 flex-shrink-0">
                <input type="text" required value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title..."
                  className="w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500 border border-gray-700"
                />
                <div className="flex gap-2">
                  <select value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <input type="text" value={newTask.assigneeName}
                    onChange={e => setNewTask({ ...newTask, assigneeName: e.target.value })}
                    placeholder="Assignee"
                    className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
                  />
                </div>
                <button type="submit" disabled={addingTask || !newTask.title.trim()}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.99] disabled:opacity-50 text-white text-xs py-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5">
                  {addingTask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add Task
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {fetchingTasks ? (
                <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-green-500" /></div>
              ) : meetingTasks.length === 0 ? (
                <div className="text-center py-10">
                  <CheckSquare size={28} className="mx-auto mb-2 text-gray-700" />
                  <p className="text-gray-500 text-xs">No tasks yet. Add one!</p>
                </div>
              ) : (
                meetingTasks.map(task => (
                  <div key={task._id} className="p-3 bg-gray-800 rounded-xl border border-gray-700">
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        task.priority === 'high' ? 'bg-red-400' :
                        task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                      }`} />
                      <p className="text-white text-xs font-medium leading-relaxed">{task.title}</p>
                    </div>
                    {task.assigneeName && <p className="text-gray-500 text-xs mb-2">👤 {task.assigneeName}</p>}
                    <select value={task.status}
                      onChange={e => handleTaskStatus(task._id, e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done ✓</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===== AI PANEL ===== */}
        {showAI && (
          <div className={`${onTheGo ? 'fixed inset-0 z-40' : 'fixed inset-0 sm:static sm:inset-auto z-40 sm:z-auto'} w-full sm:w-80 lg:w-96 bg-gray-900 flex flex-col sm:border-l border-gray-800`}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">🤖 AI Assistant</h2>
              <button onClick={() => setShowAI(false)} className="text-gray-400 hover:text-white p-1"><X size={18} /></button>
            </div>

            <div className="flex border-b border-gray-800 flex-shrink-0">
              {(['summary', 'chat'] as const).map(tab => (
                <button key={tab} onClick={() => setAiTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition capitalize ${
                    aiTab === tab ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-purple-400'
                  }`}>
                  {tab === 'summary' ? '📋 Summary' : '💬 Ask AI'}
                </button>
              ))}
            </div>

            {aiTab === 'summary' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-gray-400 text-xs">Leave empty to use chat messages as context.</p>
                <textarea value={aiTranscript} onChange={e => setAiTranscript(e.target.value)}
                  placeholder="Paste transcript (optional)..." rows={3}
                  className="w-full bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 resize-none border border-gray-700"
                />
                <button onClick={generateAISummary} disabled={aiLoading}
                  className="w-full bg-purple-600 hover:bg-purple-500 active:scale-[0.99] disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <>🧠 Generate Summary</>}
                </button>

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
                              {aiSummary.keyPoints.map((p: string, i: number) => (
                                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                                  <span className="text-purple-400 mt-0.5">•</span>{p}
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
                                    <span className={`px-1.5 py-0.5 rounded font-medium text-[10px] ${
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
                                  <span className="text-green-400">✓</span>{d}
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
            ) : (
              <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                <div className="flex flex-wrap gap-1.5">
                  {['What was decided?', 'List action items', 'Next steps?', 'Key points?'].map(q => (
                    <button key={q} onClick={() => setAiQuestion(q)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-400 transition active:scale-95">
                      {q}
                    </button>
                  ))}
                </div>
                {aiAnswer && (
                  <div className="bg-purple-900 bg-opacity-30 border border-purple-800 rounded-xl p-3 flex-1 overflow-y-auto">
                    <p className="text-purple-400 text-xs font-medium mb-1">🤖 AI Answer</p>
                    <p className="text-gray-300 text-xs leading-relaxed">{aiAnswer}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-auto">
                  <input type="text" value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && askAIQuestion()}
                    placeholder="Ask AI..."
                    className="flex-1 min-w-0 bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 border border-gray-700"
                  />
                  <button onClick={askAIQuestion} disabled={aiChatLoading || !aiQuestion.trim()}
                    className="w-9 h-9 bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition flex-shrink-0">
                    {aiChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CONTROLS BAR ===== */}
      <div className={`bg-gray-900 border-t border-gray-800 flex-shrink-0 ${onTheGo ? 'px-2 py-2' : 'px-2 sm:px-4 py-2 sm:py-3'}`}>
        <div className="flex items-center justify-between max-w-2xl lg:max-w-3xl mx-auto gap-1">

          {/* LEFT: Mic, Video, Screen */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <CtrlBtn onClick={toggleMute} active={!isMuted} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'} onTheGo={onTheGo}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </CtrlBtn>
            <CtrlBtn onClick={toggleVideo} active={!isVideoOff} danger={isVideoOff} label={isVideoOff ? 'Start' : 'Stop'} onTheGo={onTheGo}>
              {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
            </CtrlBtn>
            <CtrlBtn onClick={toggleSound} active={!isSoundOff} danger={isSoundOff} label={isSoundOff ? 'Sound' : 'Sound'} onTheGo={onTheGo} className="hidden xs:flex">
              {isSoundOff ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </CtrlBtn>
            <CtrlBtn onClick={toggleScreenShare} active={!isScreenSharing} colored={isScreenSharing ? 'blue' : undefined} label={isScreenSharing ? 'Stop' : 'Share'} onTheGo={onTheGo} className="hidden sm:flex">
              {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
            </CtrlBtn>
          </div>

          {/* CENTER: Hand, Reactions, Chat, People, CC */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <CtrlBtn onClick={toggleHand} colored={isHandRaised ? 'yellow' : undefined} label={isHandRaised ? 'Lower' : 'Raise'} onTheGo={onTheGo} className="hidden xs:flex">
              <Hand size={16} />
            </CtrlBtn>

            {/* Emoji reactions */}
            <div className="relative flex-shrink-0" ref={emojiMenuRef}>
              <CtrlBtn onClick={() => setShowEmojiPicker(!showEmojiPicker)} colored={showEmojiPicker ? 'gray' : undefined} label="React" onTheGo={onTheGo}>
                <Smile size={16} />
              </CtrlBtn>
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-2 flex gap-1 z-50">
                  {REACTION_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => sendReaction(e)}
                      className="text-2xl w-9 h-9 flex items-center justify-center hover:bg-gray-700 rounded-lg active:scale-90 transition"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <CtrlBtn onClick={() => { closeAllPanels(); setShowChat(true); setUnreadMessages(0); }}
              colored={showChat ? 'blue' : undefined} label="Chat" onTheGo={onTheGo} badge={unreadMessages > 0 && !showChat ? unreadMessages : undefined}>
              <MessageSquare size={16} />
            </CtrlBtn>

            <CtrlBtn onClick={() => { closeAllPanels(); setShowParticipants(true); }}
              colored={showParticipants ? 'blue' : undefined} label="People" onTheGo={onTheGo}>
              <Users size={16} />
            </CtrlBtn>

            <CtrlBtn onClick={toggleCaptions} colored={captions ? 'blue' : undefined} label="CC" onTheGo={onTheGo} className="hidden xs:flex">
              <Captions size={16} />
            </CtrlBtn>

            {/* More menu */}
            <div className="relative flex-shrink-0" ref={moreMenuRef}>
              <CtrlBtn onClick={() => setShowMoreMenu(!showMoreMenu)} colored={showMoreMenu ? 'gray' : undefined} label="More" onTheGo={onTheGo}>
                {onTheGo ? <MoreHorizontal size={16} /> : <ChevronUp size={16} />}
              </CtrlBtn>
              {showMoreMenu && (
                <div className="absolute bottom-14 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden w-48 z-50">
                  {/* Mobile-only items */}
                  <button onClick={() => { toggleScreenShare(); setShowMoreMenu(false); }} className="w-full sm:hidden flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm active:bg-gray-700">
                    <Monitor size={14} className="text-blue-400" />
                    {isScreenSharing ? 'Stop sharing' : 'Share screen'}
                  </button>
                  <button onClick={() => { toggleHand(); setShowMoreMenu(false); }} className="w-full xs:hidden flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Hand size={14} className="text-yellow-400" />
                    {isHandRaised ? 'Lower hand' : 'Raise hand'}
                  </button>
                  <button onClick={() => { toggleCaptions(); setShowMoreMenu(false); }} className="w-full xs:hidden flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Captions size={14} className="text-blue-400" />
                    {captions ? 'Captions off' : 'Captions on'}
                  </button>
                  <button onClick={() => { toggleSound(); setShowMoreMenu(false); }} className="w-full xs:hidden flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    {isSoundOff ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-green-400" />}
                    {isSoundOff ? 'Sound on' : 'Mute sound'}
                  </button>
                  <div className="border-t border-gray-700" />
                  <button onClick={() => { setShowSettings(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Settings size={14} className="text-blue-400" /> Settings
                  </button>
                  <button onClick={() => { setShowReportModal(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Flag size={14} className="text-red-400" /> Report abuse
                  </button>
                  <button onClick={() => { copyCode(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Copy size={14} className="text-green-400" /> Copy code
                  </button>
                  <button onClick={() => { setOnTheGo(!onTheGo); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm">
                    <Smartphone size={14} className="text-orange-400" />
                    {onTheGo ? 'Normal mode' : 'On-the-Go mode'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Leave, End */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <CtrlBtn onClick={handleLeaveMeeting} label="Leave" onTheGo={onTheGo} className="hidden xs:flex">
              <LogOut size={16} />
            </CtrlBtn>
            <button onClick={handleEndMeeting}
              className={`flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-full font-medium transition ${onTheGo ? 'px-3 py-2 text-xs' : 'px-3 sm:px-4 py-2 sm:py-2.5 text-sm'}`}>
              <PhoneOff size={15} className="flex-shrink-0" />
              <span className="hidden xs:inline">End</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (min-width: 480px) {
          .xs\\:flex { display: flex; }
          .xs\\:hidden { display: none; }
          .xs\\:inline { display: inline; }
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { opacity: 1; transform: translateY(-20px) scale(1.2); }
          100% { transform: translateY(-240px) scale(1); opacity: 0; }
        }
        .float-emoji {
          animation: floatUp 2.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

// ===== Control Button Component =====
interface CtrlBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
  active?: boolean;
  danger?: boolean;
  colored?: 'blue' | 'yellow' | 'green' | 'gray';
  onTheGo?: boolean;
  badge?: number;
  className?: string;
}

const CtrlBtn = ({ onClick, children, label, danger, colored, onTheGo, badge, className = 'flex' }: CtrlBtnProps) => {
  const bg =
    danger ? 'bg-red-600 hover:bg-red-500' :
    colored === 'blue' ? 'bg-blue-600 hover:bg-blue-500' :
    colored === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-500' :
    colored === 'green' ? 'bg-green-600 hover:bg-green-500' :
    colored === 'gray' ? 'bg-gray-700 hover:bg-gray-600' :
    'bg-gray-800 hover:bg-gray-700';

  const size = onTheGo ? 'w-9 h-9' : 'w-9 h-9 sm:w-11 sm:h-11';

  return (
    <button onClick={onClick} className={`${className} flex-col items-center gap-0.5 flex-shrink-0 relative`}>
      <div className={`${size} ${bg} rounded-full flex items-center justify-center transition active:scale-95 text-white`}>
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {label && !onTheGo && <span className="hidden sm:inline text-gray-500 text-[10px] leading-tight">{label}</span>}
    </button>
  );
};

export default MeetingRoom;