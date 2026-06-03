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

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
  handRaised?: boolean;
  isScreenSharing?: boolean;
}

const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [copied, setCopied] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUser, setScreenSharingUser] = useState<string | null>(null);
  const [captions, setCaptions] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [joinRejected, setJoinRejected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const getJoinCount = () => parseInt(localStorage.getItem(`im_join_${id}`) || '0');
  const incrementJoinCount = () => {
    const count = getJoinCount() + 1;
    localStorage.setItem(`im_join_${id}`, count.toString());
    return count;
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetchMeeting();
    startVideo();
    const currentCount = getJoinCount();
    if (currentCount >= MAX_FREE_JOINS) {
      setWaitingForApproval(true);
      setupSocket(false);
      setTimeout(() => requestHostApproval(), 1000);
    } else {
      incrementJoinCount();
      setupSocket(true);
    }
    return () => {
      cleanupMedia();
      socketRef.current?.disconnect();
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
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanupMedia = () => {
    localStreamRef.current?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
  };

  const fetchMeeting = async () => {
    try {
      const response = await getMeeting(id!);
      setMeeting(response.meeting);
      const hostId = response.meeting?.host?._id || response.meeting?.host;
      setIsHost(hostId === user?.id);
    } catch (err) { console.error('Failed to fetch meeting'); }
  };

  const setupSocket = (autoJoin: boolean) => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token }, transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      if (autoJoin) {
        socketRef.current?.emit('join-meeting', {
          meetingId: id, userId: user?.id,
          userName: user?.name, isHost
        });
        socketRef.current?.emit('get-messages', { meetingId: id });
      }
    });

    socketRef.current.on('user-joined', ({ userName }) => addSystemMsg(`${userName} joined`));
    socketRef.current.on('user-left', ({ userName }) => addSystemMsg(`${userName} left`));
    socketRef.current.on('participants-list', setParticipants);
    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', setMessages);
    socketRef.current.on('user-typing', ({ userName }) => { setTypingUser(userName); setIsTyping(true); });
    socketRef.current.on('user-stop-typing', () => { setIsTyping(false); setTypingUser(''); });

    // Raise Hand
    socketRef.current.on('hand-raised', ({ userId, userName }) => {
      setRaisedHands(prev => [...prev.filter(id => id !== userId), userId]);
      showNotification(`✋ ${userName} raised their hand`);
    });
    socketRef.current.on('hand-lowered', ({ userId }) => {
      setRaisedHands(prev => prev.filter(id => id !== userId));
    });

    // Screen Share
    socketRef.current.on('user-screen-sharing', ({ userName }) => {
      setScreenSharingUser(userName);
      showNotification(`🖥️ ${userName} started screen sharing`);
    });
    socketRef.current.on('user-screen-share-stopped', () => {
      setScreenSharingUser(null);
    });

    // Captions
    socketRef.current.on('receive-caption', ({ userName, text }) => {
      setCaptionText(`${userName}: ${text}`);
      setTimeout(() => setCaptionText(''), 3000);
    });

    // Join request
    socketRef.current.on('join-request', (request) => {
      setJoinRequests(prev => [...prev, request]);
    });
    socketRef.current.on('join-approved', () => {
      setWaitingForApproval(false);
      incrementJoinCount();
      socketRef.current?.emit('join-meeting', {
        meetingId: id, userId: user?.id, userName: user?.name, isHost
      });
      socketRef.current?.emit('get-messages', { meetingId: id });
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

  const requestHostApproval = () => {
    socketRef.current?.emit('request-join', {
      meetingId: id, userId: user?.id, userName: user?.name
    });
  };

  const addSystemMsg = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now(), type: 'system',
      message: text, timestamp: new Date().toISOString()
    }]);
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) { console.error('Camera/mic denied'); }
  };

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

  const toggleHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    if (newState) {
      socketRef.current?.emit('raise-hand', { meetingId: id, userId: user?.id, userName: user?.name });
      showNotification('✋ You raised your hand');
    } else {
      socketRef.current?.emit('lower-hand', { meetingId: id, userId: user?.id });
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        setScreenSharingUser('You');
        socketRef.current?.emit('screen-share-started', {
          meetingId: id, userId: user?.id, userName: user?.name
        });
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
        showNotification('🖥️ Screen sharing started');
      } catch (err) {
        showNotification('❌ Screen share cancelled');
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    setIsScreenSharing(false);
    setScreenSharingUser(null);
    socketRef.current?.emit('screen-share-stopped', { meetingId: id, userId: user?.id });
    showNotification('🖥️ Screen sharing stopped');
  };

  const toggleCaptions = () => {
    setCaptions(!captions);
    showNotification(captions ? 'Captions off' : 'Live captions on');
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send-message', {
      meetingId: id, userId: user?.id, userName: user?.name, message: newMessage
    });
    if (captions) {
      socketRef.current?.emit('caption-text', {
        meetingId: id, userId: user?.id, userName: user?.name, text: newMessage
      });
    }
    socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id });
    setNewMessage('');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    socketRef.current?.emit('typing', { meetingId: id, userId: user?.id, userName: user?.name });
    setTimeout(() => socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id }), 2000);
  };

  const submitReport = () => {
    if (!reportReason.trim()) return;
    socketRef.current?.emit('report-user', {
      meetingId: id, reason: reportReason,
      reportedBy: user?.name, reportedUserId: 'meeting',
      reportedUserName: 'meeting'
    });
  };

  const approveJoinRequest = (req: any) => {
    socketRef.current?.emit('approve-join', { socketId: req.socketId, meetingId: id, userName: req.userName });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
    addSystemMsg(`${req.userName} was approved to join`);
  };

  const rejectJoinRequest = (req: any) => {
    socketRef.current?.emit('reject-join', { socketId: req.socketId, userName: req.userName });
    setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
  };

  const handleLeaveMeeting = useCallback(() => {
    cleanupMedia();
    socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
    socketRef.current?.disconnect();
    navigate('/dashboard');
  }, [id, user, navigate]);

  const handleEndMeeting = async () => {
    try {
      cleanupMedia();
      socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
      socketRef.current?.disconnect();
      await endMeeting(id!);
      localStorage.removeItem(`im_join_${id}`);
      navigate('/dashboard');
    } catch { navigate('/dashboard'); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(meeting?.meetingCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Waiting screen
  if (waitingForApproval) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <UserCheck size={32} className="text-blue-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Waiting for Approval</h2>
          <p className="text-gray-400 text-sm mb-6">The host will let you in shortly.</p>
          <div className="flex gap-1 justify-center mb-6">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm">← Back</button>
        </div>
      </div>
    );
  }

  // Rejected screen
  if (joinRejected) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-red-900 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX size={32} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Request Declined</h2>
          <p className="text-gray-400 text-sm mb-6">The host declined your request.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-500 transition text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-full text-sm shadow-xl border border-gray-700 animate-pulse">
          {notification}
        </div>
      )}

      {/* Join Requests (Host only) */}
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
                <button onClick={() => approveJoinRequest(req)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
                  <Check size={14} /> Accept
                </button>
                <button onClick={() => rejectJoinRequest(req)} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1 transition">
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
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            {reportSubmitted ? (
              <div className="text-center py-4">
                <Check size={32} className="text-green-400 mx-auto mb-2" />
                <p className="text-white">Report submitted!</p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">Describe the issue you're experiencing in this meeting.</p>
                <div className="space-y-2 mb-4">
                  {['Inappropriate behavior', 'Spam or harassment', 'Unauthorized recording', 'Technical abuse', 'Other'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`w-full text-left text-sm p-3 rounded-xl border transition ${
                        reportReason === reason
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitReport}
                  disabled={!reportReason}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium transition"
                >
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
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Microphone</p>
                  <p className="text-gray-400 text-xs">{isMuted ? 'Muted' : 'Active'}</p>
                </div>
                <button onClick={toggleMute} className={`w-10 h-6 rounded-full transition ${isMuted ? 'bg-red-600' : 'bg-green-500'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${isMuted ? 'translate-x-0' : 'translate-x-4'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Camera</p>
                  <p className="text-gray-400 text-xs">{isVideoOff ? 'Off' : 'On'}</p>
                </div>
                <button onClick={toggleVideo} className={`w-10 h-6 rounded-full transition ${isVideoOff ? 'bg-red-600' : 'bg-green-500'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${isVideoOff ? 'translate-x-0' : 'translate-x-4'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Live Captions</p>
                  <p className="text-gray-400 text-xs">{captions ? 'On' : 'Off'}</p>
                </div>
                <button onClick={toggleCaptions} className={`w-10 h-6 rounded-full transition ${captions ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${captions ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className="text-white text-sm font-medium mb-1">Meeting Code</p>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm">{meeting?.meetingCode}</span>
                  <button onClick={copyCode} className="text-gray-400 hover:text-white">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              {isHost && (
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-white text-sm font-medium mb-1">Host Controls</p>
                  <p className="text-gray-400 text-xs">You are the host of this meeting</p>
                  <div className="mt-2 flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-yellow-400 text-xs">Host privileges active</span>
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
          </div>
          <button onClick={copyCode} className="hidden sm:flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition">
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {meeting?.meetingCode}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {raisedHands.length > 0 && (
            <span className="flex items-center gap-1 text-yellow-400 text-xs bg-yellow-400 bg-opacity-10 px-2 py-1 rounded-full">
              ✋ {raisedHands.length}
            </span>
          )}
          {screenSharingUser && (
            <span className="flex items-center gap-1 text-blue-400 text-xs bg-blue-400 bg-opacity-10 px-2 py-1 rounded-full">
              🖥️ {screenSharingUser === 'You' ? 'You' : screenSharingUser} sharing
            </span>
          )}
          <span className="flex items-center gap-1.5 text-green-400 text-xs bg-green-400 bg-opacity-10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
          <span className="text-gray-400 text-xs flex items-center gap-1">
            <Users size={12} /> {participants.length}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video Area */}
        <div className="flex-1 p-3 flex flex-col gap-3">
          {/* Screen Share Video */}
          {isScreenSharing && (
            <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden border border-blue-500 relative">
              <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Monitor size={11} /> Screen Share
              </div>
            </div>
          )}

          {/* Camera Video */}
          <div className={`bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 relative ${isScreenSharing ? 'h-36 flex-shrink-0' : 'flex-1'}`}>
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {isVideoOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl text-white font-bold shadow-xl">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              {isMuted && <MicOff size={11} className="text-red-400" />}
              {isHandRaised && <span></span>}
              {user?.name} (You)
            </div>
          </div>

          {/* Captions */}
          {captions && captionText && (
            <div className="bg-black bg-opacity-80 text-white text-sm text-center p-3 rounded-xl border border-gray-700">
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
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-full break-words ${
                        msg.userId === user?.id ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                      }`}>{msg.message}</div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="text-gray-500 text-xs italic">{typingUser} typing...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input
                type="text" value={newMessage} onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message..." className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
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
              <h2 className="text-white font-semibold text-sm">People ({participants.length})</h2>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {participants.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No participants</p>
              ) : (
                participants.map((p: any, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {p.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{p.userName}</p>
                      <p className="text-gray-500 text-xs">{p.role}</p>
                    </div>
                    {raisedHands.includes(p.userId) && <span className="text-sm">✋</span>}
                    {p.isScreenSharing && <Monitor size={12} className="text-blue-400" />}
                  </div>
                ))
              )}
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
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showChat ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <MessageSquare size={18} className="text-white" />
                {unreadMessages > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{unreadMessages}</span>
                )}
              </div>
              <span className="text-gray-500 text-xs">Chat</span>
            </button>

            <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showParticipants ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <Users size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">People</span>
            </button>

            <button onClick={toggleCaptions} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${captions ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <Captions size={18} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">CC</span>
            </button>

            {/* More Menu */}
            <div className="relative" ref={moreMenuRef}>
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="flex flex-col items-center gap-0.5">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showMoreMenu ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  <ChevronUp size={18} className="text-white" />
                </div>
                <span className="text-gray-500 text-xs">More</span>
              </button>

              {showMoreMenu && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden w-44 z-50">
                  <button
                    onClick={() => { setShowSettings(true); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm transition"
                  >
                    <Settings size={16} className="text-blue-400" /> Settings
                  </button>
                  <button
                    onClick={() => { setShowReportModal(true); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm transition"
                  >
                    <Flag size={16} className="text-red-400" /> Report abuse
                  </button>
                  <button
                    onClick={() => { copyCode(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-200 hover:bg-gray-700 text-sm transition"
                  >
                    <Copy size={16} className="text-green-400" /> Copy code
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