import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  LogOut, PhoneOff, Send, Users, Copy, Check
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getMeeting, endMeeting } from '../../services/meetingService';

const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMeeting();
    setupSocket();
    startVideo();
    return () => {
      socketRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (showChat) setUnreadCount(0);
  }, [messages]);

  useEffect(() => {
    if (!showChat) setUnreadCount(prev => prev + 1);
  }, [messages.length]);

  const fetchMeeting = async () => {
    try {
      const response = await getMeeting(id!);
      setMeeting(response.meeting);
    } catch (err) { console.error('Failed to fetch meeting'); }
  };

  const setupSocket = () => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token }, transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('join-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
      socketRef.current?.emit('get-messages', { meetingId: id });
    });

    socketRef.current.on('user-joined', ({ userName }) => {
      setMessages(prev => [...prev, { id: Date.now(), type: 'system', message: `${userName} joined`, timestamp: new Date().toISOString() }]);
    });

    socketRef.current.on('user-left', ({ userName }) => {
      setMessages(prev => [...prev, { id: Date.now(), type: 'system', message: `${userName} left`, timestamp: new Date().toISOString() }]);
    });

    socketRef.current.on('participants-list', setParticipants);
    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', setMessages);
    socketRef.current.on('user-typing', ({ userName }) => { setTypingUser(userName); setIsTyping(true); });
    socketRef.current.on('user-stop-typing', () => { setIsTyping(false); setTypingUser(''); });
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) { console.error('Camera access denied'); }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send-message', { meetingId: id, userId: user?.id, userName: user?.name, message: newMessage });
    socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id });
    setNewMessage('');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    socketRef.current?.emit('typing', { meetingId: id, userId: user?.id, userName: user?.name });
    setTimeout(() => socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id }), 2000);
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

  const handleEndMeeting = async () => {
    try {
      socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
      await endMeeting(id!);
      navigate('/dashboard');
    } catch { navigate('/dashboard'); }
  };

  const handleLeaveMeeting = () => {
    socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
    navigate('/dashboard');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(meeting?.meetingCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🤖</div>
            <h1 className="text-white font-semibold">{meeting?.title || 'Meeting'}</h1>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {meeting?.meetingCode}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-green-400 text-xs bg-green-400 bg-opacity-10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
          <span className="flex items-center gap-1 text-gray-400 text-xs">
            <Users size={12} />
            {participants.length} participants
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video */}
        <div className="flex-1 p-4">
          <div className="bg-gray-900 rounded-2xl overflow-hidden h-full relative border border-gray-800">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {isVideoOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl text-white font-bold shadow-xl">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            {/* Name tag */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="bg-black bg-opacity-60 backdrop-blur text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                {isMuted && <MicOff size={12} className="text-red-400" />}
                {user?.name} (You)
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Meeting Chat</h2>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.type === 'system' ? (
                    <div className="text-center">
                      <span className="text-gray-500 text-xs bg-gray-800 px-3 py-1 rounded-full">{msg.message}</span>
                    </div>
                  ) : (
                    <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-gray-400 text-xs">{msg.userName}</span>
                        <span className="text-gray-600 text-xs">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${
                        msg.userId === user?.id
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="bg-gray-800 px-3 py-2 rounded-full text-gray-400 text-xs">
                    {typingUser} is typing...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message..."
                className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-500 transition"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-72 bg-gray-900 flex flex-col border-l border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Participants ({participants.length})</h2>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {participants.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No participants yet</p>
              ) : (
                participants.map((p: any, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {p.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{p.userName}</p>
                      <p className="text-gray-500 text-xs">{p.role || 'participant'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">

          {/* Left controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center gap-1 group`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'
              }`}>
                {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
              </div>
              <span className="text-gray-500 text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={toggleVideo} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                isVideoOff ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'
              }`}>
                {isVideoOff ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
              </div>
              <span className="text-gray-500 text-xs">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </button>
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowChat(!showChat); setShowParticipants(false); setUnreadCount(0); }}
              className="flex flex-col items-center gap-1 relative"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                showChat ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'
              }`}>
                <MessageSquare size={20} className="text-white" />
                {unreadCount > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span className="text-gray-500 text-xs">Chat</span>
            </button>

            <button
              onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
              className="flex flex-col items-center gap-1"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                showParticipants ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'
              }`}>
                <Users size={20} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">People</span>
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <button onClick={handleLeaveMeeting} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition">
                <LogOut size={20} className="text-white" />
              </div>
              <span className="text-gray-500 text-xs">Leave</span>
            </button>

            <button
              onClick={handleEndMeeting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-full font-medium transition"
            >
              <PhoneOff size={18} />
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;