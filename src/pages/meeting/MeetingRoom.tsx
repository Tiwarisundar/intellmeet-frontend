import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, MessageSquare, LogOut, PhoneOff, Send } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');

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
  }, [messages]);

  const fetchMeeting = async () => {
    try {
      const response = await getMeeting(id!);
      setMeeting(response.meeting);
    } catch (err) {
      console.error('Failed to fetch meeting');
    }
  };

  const setupSocket = () => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('join-meeting', {
        meetingId: id,
        userId: user?.id,
        userName: user?.name
      });
      socketRef.current?.emit('get-messages', { meetingId: id });
    });

    socketRef.current.on('user-joined', ({ userName }) => {
      setMessages(prev => [...prev, {
        id: Date.now(), type: 'system',
        message: `${userName} joined the meeting`,
        timestamp: new Date().toISOString()
      }]);
    });

    socketRef.current.on('user-left', ({ userName }) => {
      setMessages(prev => [...prev, {
        id: Date.now(), type: 'system',
        message: `${userName} left the meeting`,
        timestamp: new Date().toISOString()
      }]);
    });

    socketRef.current.on('participants-list', (list) => setParticipants(list));
    socketRef.current.on('receive-message', (msg) => setMessages(prev => [...prev, msg]));
    socketRef.current.on('messages-history', (history) => setMessages(history));

    socketRef.current.on('user-typing', ({ userName }) => {
      setTypingUser(userName);
      setIsTyping(true);
    });

    socketRef.current.on('user-stop-typing', () => {
      setIsTyping(false);
      setTypingUser('');
    });
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera access denied');
    }
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
    socketRef.current?.emit('typing', {
      meetingId: id, userId: user?.id, userName: user?.name
    });
    setTimeout(() => {
      socketRef.current?.emit('stop-typing', { meetingId: id, userId: user?.id });
    }, 2000);
  };

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

  const handleEndMeeting = async () => {
    try {
      socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
      await endMeeting(id!);
      navigate('/dashboard');
    } catch (err) {
      navigate('/dashboard');
    }
  };

  const handleLeaveMeeting = () => {
    socketRef.current?.emit('leave-meeting', { meetingId: id, userId: user?.id, userName: user?.name });
    navigate('/dashboard');
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">

      {/* Header */}
      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold">{meeting?.title || 'Meeting'}</h1>
          <p className="text-gray-400 text-sm">
            Code: {meeting?.meetingCode} · {participants.length} participants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-sm flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video area */}
        <div className="flex-1 p-4">
          <div className="bg-gray-800 rounded-2xl overflow-hidden h-full flex items-center justify-center relative">
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              className="w-full h-full object-cover"
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center text-3xl text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-full">
              {user?.name} (You)
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-white font-medium">Meeting Chat</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.type === 'system' ? (
                    <div className="text-center text-gray-500 text-xs py-1">{msg.message}</div>
                  ) : (
                    <div className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <span className="text-gray-400 text-xs mb-1">{msg.userName}</span>
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${
                        msg.userId === user?.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="text-gray-400 text-xs italic">{typingUser} is typing...</div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-700"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            isMuted ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isVideoOff ? 'Turn on video' : 'Turn off video'}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            showChat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title="Toggle Chat"
        >
          <MessageSquare size={20} />
        </button>

        <button
          onClick={handleLeaveMeeting}
          className="w-12 h-12 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-600 transition"
          title="Leave Meeting"
        >
          <LogOut size={20} />
        </button>

        <button
          onClick={handleEndMeeting}
          className="bg-red-600 text-white px-6 py-3 rounded-full font-medium hover:bg-red-700 transition flex items-center gap-2"
        >
          <PhoneOff size={18} />
          End Meeting
        </button>
      </div>
    </div>
  );
};

export default MeetingRoom;