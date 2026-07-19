import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bluetooth, Calendar, Video, VideoOff,
  Mic, MicOff, MoreVertical, PhoneOff, ChevronUp, X,
  Hand, ScreenShare, Captions, Smartphone, MessageSquare,
  Flag, Settings as SettingsIcon, Volume2, Send, ChevronRight, Check
} from 'lucide-react';
import useThemeStore from '../../store/themeStore';

type Panel = null | 'more' | 'chat' | 'report' | 'settings' | 'sound';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface Participant {
  id: string;
  name: string;
  avatarUrl?: string;
  isMuted: boolean;
  color?: string;
}

const AVATAR_COLORS = [
  '#5B6B8C', '#E8622C', '#C42D6E', '#2E7D8C',
  '#3B7DD8', '#8C3B3B', '#6B4FA0', '#4A8C5F'
];

const colorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Replace with real participants from your call/session state
const MOCK_PARTICIPANTS: Participant[] = [
  { id: '1', name: 'Disha', isMuted: true },
  { id: '2', name: 'Kiran', isMuted: true },
  { id: '3', name: 'Manisha', isMuted: true },
  { id: '4', name: 'Sriram', isMuted: true, avatarUrl: 'https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=200' },
  { id: '5', name: 'Mitesh', isMuted: true },
  { id: '6', name: 'Vidya', isMuted: true, avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
  { id: '7', name: 'Yash', isMuted: true },
  { id: '8', name: 'Mansi', isMuted: true },
  { id: '9', name: 'Shravani', isMuted: true, avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200' },
];

const MeetingRoom = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const [participants] = useState<Participant[]>(MOCK_PARTICIPANTS);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [joinToast, setJoinToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meetingCode = 'ukj-mgcr-rwo';

  // ===== Add-on feature state =====
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [onTheGo, setOnTheGo] = useState(false);
  const [caption, setCaption] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'c1', sender: 'Kiran', text: 'Can everyone see the shared slide?', time: '11:02' },
    { id: 'c2', sender: 'Mitesh', text: 'Yes, looks good on my end', time: '11:03' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [volume, setVolume] = useState(80);
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [audioOutput, setAudioOutput] = useState<'speaker' | 'earpiece' | 'bluetooth'>('speaker');

  const closePanel = () => setActivePanel(null);

  // Demo captions ticker while captionsOn is true
  useEffect(() => {
    if (!captionsOn) { setCaption(''); return; }
    const lines = [
      'Rahul: Let\u2019s move to the next agenda item...',
      'Priya: I\u2019ll share the updated design by tomorrow.',
      'Amit: Sounds good, I\u2019ll sync with backend team.',
    ];
    let i = 0;
    setCaption(lines[0]);
    const id = setInterval(() => {
      i = (i + 1) % lines.length;
      setCaption(lines[i]);
    }, 3500);
    return () => clearInterval(id);
  }, [captionsOn]);

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, {
      id: `c${Date.now()}`,
      sender: 'You',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const submitReport = () => {
    if (!reportText.trim()) return;
    setReportSent(true);
    setTimeout(() => { setReportSent(false); setReportText(''); closePanel(); }, 1500);
  };

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-100';
  const tileBg = isDark ? 'bg-gray-800' : 'bg-gray-300';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const pillBg = isDark ? 'bg-gray-800/90' : 'bg-white/90';
  const barBg = isDark ? 'bg-gray-900' : 'bg-white';
  const sheetBg = isDark ? 'bg-gray-900' : 'bg-white';
  const sheetBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const rowHover = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400';

  // Demo: simulate a participant joining, replace with real socket/event data
  useEffect(() => {
    const t = setTimeout(() => setJoinToast('Shravani Pathak joined'), 1500);
    const clear = setTimeout(() => setJoinToast(null), 4500);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) setShowScrollTop(scrollRef.current.scrollTop > 200);
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className={`h-screen ${bg} flex flex-col overflow-hidden transition-colors duration-200`}>

      {/* ===== TOP BAR ===== */}
      <div className="safe-top px-3 pt-3 pb-2 flex items-center gap-2 flex-shrink-0 z-20">
        <button
          onClick={() => navigate(-1)}
          aria-label="Leave and go back"
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition ${pillBg} ${textPrimary}`}
        >
          <ArrowLeft size={18} />
        </button>

        <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-full ${pillBg} min-w-0`}>
          <Calendar size={14} className={textPrimary} />
          <span className={`text-sm font-medium truncate ${textPrimary}`}>{meetingCode}</span>
        </div>

        <button
          aria-label="Bluetooth devices"
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition ${pillBg} ${textPrimary}`}
        >
          <Bluetooth size={18} />
        </button>
      </div>

      {/* Screen share banner */}
      {screenSharing && (
        <div className="mx-3 mb-2 flex-shrink-0 flex items-center justify-between gap-2 bg-blue-600 text-white text-xs sm:text-sm px-3 py-2 rounded-xl">
          <span className="flex items-center gap-1.5 truncate"><ScreenShare size={14} className="flex-shrink-0" /> You're presenting to everyone</span>
          <button onClick={() => setScreenSharing(false)} className="flex-shrink-0 font-medium underline underline-offset-2">Stop</button>
        </div>
      )}

      {/* On-the-go banner */}
      {onTheGo && (
        <div className={`mx-3 mb-2 flex-shrink-0 flex items-center justify-between gap-2 ${pillBg} ${textPrimary} text-xs sm:text-sm px-3 py-2 rounded-xl`}>
          <span className="flex items-center gap-1.5 truncate"><Smartphone size={14} className="flex-shrink-0" /> Companion mode is on \u2014 audio &amp; video off</span>
          <button onClick={() => setOnTheGo(false)} className="flex-shrink-0 font-medium underline underline-offset-2">Turn off</button>
        </div>
      )}

      {/* Hand raised indicator */}
      {handRaised && (
        <div className="mx-3 mb-2 flex-shrink-0 flex items-center gap-1.5 justify-center">
          <div className="bg-yellow-500 text-black text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Hand size={13} /> You raised your hand
          </div>
        </div>
      )}

      {/* ===== PARTICIPANT GRID ===== */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 pb-3 relative"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {participants.map((p) => (
            <div
              key={p.id}
              className={`relative aspect-square rounded-2xl overflow-hidden flex items-center justify-center ${tileBg}`}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
                  style={{ backgroundColor: p.color || colorForName(p.name) }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Name + mic chip */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full pl-1.5 pr-2.5 py-1">
                <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center flex-shrink-0">
                  <MicOff size={11} className="text-white" />
                </span>
                <span className="text-white text-xs font-medium truncate max-w-[90px]">{p.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Join toast */}
        {joinToast && (
          <div className="sticky bottom-2 flex justify-center mt-3 z-10">
            <div className={`${pillBg} ${textPrimary} text-sm px-4 py-2 rounded-full shadow-lg`}>
              {joinToast}
            </div>
          </div>
        )}

        {/* Return to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className={`fixed right-3 top-20 flex items-center gap-1 ${pillBg} ${textPrimary} text-xs font-medium px-3 py-2 rounded-full shadow-lg active:scale-95 transition z-10`}
          >
            <ChevronUp size={14} /> Return to top
          </button>
        )}
      </div>

      {/* ===== LIVE CAPTIONS STRIP ===== */}
      {captionsOn && (
        <div className={`flex-shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl bg-black/80 text-white text-sm leading-snug`}>
          <span className="text-[10px] uppercase tracking-wide text-gray-400 block mb-0.5">Captions</span>
          {caption}
        </div>
      )}

      {/* ===== BOTTOM CONTROL BAR ===== */}
      <div className={`flex-shrink-0 ${barBg} border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} px-3 pt-2 pb-safe`}>
        <div className="flex items-center justify-center gap-2 py-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCameraOn(v => !v)}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0 ${
              cameraOn
                ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800')
                : 'bg-red-500/20 text-red-500'
            }`}
          >
            {cameraOn ? <Video size={19} /> : <VideoOff size={19} />}
          </button>

          <button
            onClick={() => setMicOn(v => !v)}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0 ${
              micOn
                ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800')
                : 'bg-red-500/20 text-red-500'
            }`}
          >
            {micOn ? <Mic size={19} /> : <MicOff size={19} />}
          </button>

          <button
            onClick={() => setHandRaised(v => !v)}
            aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0 ${
              handRaised
                ? 'bg-yellow-500 text-black'
                : (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800')
            }`}
          >
            <Hand size={18} />
          </button>

          <button
            onClick={() => setActivePanel('more')}
            aria-label="More options"
            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0 ${
              isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            <MoreVertical size={18} />
          </button>

          <button
            onClick={() => navigate(-1)}
            aria-label="Leave call"
            className="w-14 h-11 sm:h-12 rounded-full bg-red-600 text-white flex items-center justify-center active:scale-95 transition hover:bg-red-500 flex-shrink-0"
          >
            <PhoneOff size={19} />
          </button>
        </div>
      </div>

      {/* ===== MORE OPTIONS BOTTOM SHEET ===== */}
      {activePanel === 'more' && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
          <div className={`relative w-full max-w-md ${sheetBg} rounded-t-2xl pb-safe max-h-[75vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${sheetBorder} sticky top-0 ${sheetBg} z-10`}>
              <span className={`font-semibold text-sm ${textPrimary}`}>More options</span>
              <button onClick={closePanel} aria-label="Close" className={`w-8 h-8 rounded-full flex items-center justify-center ${rowHover} ${textSecondary}`}>
                <X size={16} />
              </button>
            </div>

            <div className="py-1">
              <SheetRow
                icon={<ScreenShare size={18} />}
                label={screenSharing ? 'Stop screen share' : 'Share screen'}
                onClick={() => { setScreenSharing(v => !v); closePanel(); }}
                active={screenSharing}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<Captions size={18} />}
                label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
                onClick={() => setCaptionsOn(v => !v)}
                active={captionsOn}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<Smartphone size={18} />}
                label="Switch to companion mode (on the go)"
                onClick={() => { setOnTheGo(v => !v); closePanel(); }}
                active={onTheGo}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<MessageSquare size={18} />}
                label="Chat with everyone"
                onClick={() => setActivePanel('chat')}
                chevron
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<Volume2 size={18} />}
                label="Sound"
                onClick={() => setActivePanel('sound')}
                chevron
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<SettingsIcon size={18} />}
                label="Settings"
                onClick={() => setActivePanel('settings')}
                chevron
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
              <SheetRow
                icon={<Flag size={18} />}
                label="Report a problem"
                onClick={() => setActivePanel('report')}
                chevron
                danger
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                rowHover={rowHover}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== CHAT PANEL ===== */}
      {activePanel === 'chat' && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
          <div className={`relative w-full max-w-md ${sheetBg} rounded-t-2xl h-[80vh] flex flex-col`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${sheetBorder} flex-shrink-0`}>
              <span className={`font-semibold text-sm ${textPrimary}`}>In-call messages</span>
              <button onClick={closePanel} aria-label="Close chat" className={`w-8 h-8 rounded-full flex items-center justify-center ${rowHover} ${textSecondary}`}>
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.map(m => (
                <div key={m.id} className={m.sender === 'You' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    m.sender === 'You'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : `${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} rounded-bl-sm`
                  }`}>
                    {m.sender !== 'You' && <p className="text-xs font-semibold mb-0.5 opacity-80">{m.sender}</p>}
                    <p className="leading-relaxed">{m.text}</p>
                  </div>
                  <span className={`text-[10px] ${textSecondary} mt-0.5 px-1`}>{m.time}</span>
                </div>
              ))}
            </div>

            <div className={`flex-shrink-0 flex items-center gap-2 p-3 border-t ${sheetBorder} pb-safe`}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Send a message to everyone"
                className={`flex-1 border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition min-w-0 ${inputBg}`}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                aria-label="Send message"
                className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-500 disabled:opacity-40 transition flex-shrink-0 active:scale-95"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SOUND PANEL ===== */}
      {activePanel === 'sound' && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
          <div className={`relative w-full max-w-md ${sheetBg} rounded-t-2xl pb-safe`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${sheetBorder}`}>
              <span className={`font-semibold text-sm ${textPrimary}`}>Sound</span>
              <button onClick={closePanel} aria-label="Close" className={`w-8 h-8 rounded-full flex items-center justify-center ${rowHover} ${textSecondary}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-2`}>Output device</p>
                <div className="space-y-1.5">
                  {(['speaker', 'earpiece', 'bluetooth'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAudioOutput(opt)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm capitalize transition ${
                        audioOutput === opt
                          ? 'bg-purple-600 text-white'
                          : `${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`
                      }`}
                    >
                      {opt === 'bluetooth' ? 'Bluetooth device' : opt}
                      {audioOutput === opt && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-medium ${textSecondary}`}>Volume</p>
                  <span className={`text-xs ${textSecondary}`}>{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SETTINGS PANEL ===== */}
      {activePanel === 'settings' && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
          <div className={`relative w-full max-w-md ${sheetBg} rounded-t-2xl pb-safe max-h-[75vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${sheetBorder}`}>
              <span className={`font-semibold text-sm ${textPrimary}`}>Settings</span>
              <button onClick={closePanel} aria-label="Close" className={`w-8 h-8 rounded-full flex items-center justify-center ${rowHover} ${textSecondary}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>Noise cancellation</p>
                  <p className={`text-xs ${textSecondary}`}>Reduce background noise on your mic</p>
                </div>
                <button
                  onClick={() => setNoiseCancellation(v => !v)}
                  aria-label="Toggle noise cancellation"
                  className={`w-11 h-6 rounded-full flex-shrink-0 transition relative ${noiseCancellation ? 'bg-purple-600' : (isDark ? 'bg-gray-700' : 'bg-gray-300')}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${noiseCancellation ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between pt-4 border-t ${sheetBorder}`}>
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>Captions</p>
                  <p className={`text-xs ${textSecondary}`}>Show live captions during the call</p>
                </div>
                <button
                  onClick={() => setCaptionsOn(v => !v)}
                  aria-label="Toggle captions"
                  className={`w-11 h-6 rounded-full flex-shrink-0 transition relative ${captionsOn ? 'bg-purple-600' : (isDark ? 'bg-gray-700' : 'bg-gray-300')}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${captionsOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between pt-4 border-t ${sheetBorder}`}>
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>Companion mode</p>
                  <p className={`text-xs ${textSecondary}`}>Join without camera or mic (on the go)</p>
                </div>
                <button
                  onClick={() => setOnTheGo(v => !v)}
                  aria-label="Toggle companion mode"
                  className={`w-11 h-6 rounded-full flex-shrink-0 transition relative ${onTheGo ? 'bg-purple-600' : (isDark ? 'bg-gray-700' : 'bg-gray-300')}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${onTheGo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== REPORT A PROBLEM PANEL ===== */}
      {activePanel === 'report' && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
          <div className={`relative w-full max-w-md ${sheetBg} rounded-t-2xl pb-safe`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${sheetBorder}`}>
              <span className={`font-semibold text-sm ${textPrimary}`}>Report a problem</span>
              <button onClick={closePanel} aria-label="Close" className={`w-8 h-8 rounded-full flex items-center justify-center ${rowHover} ${textSecondary}`}>
                <X size={16} />
              </button>
            </div>

            {reportSent ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-green-500/15 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Flag size={20} />
                </div>
                <p className={`text-sm font-medium ${textPrimary}`}>Thanks, we got your report</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <p className={`text-xs ${textSecondary}`}>Tell us what went wrong. We'll use this to improve call quality.</p>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  rows={4}
                  placeholder="Describe the issue (audio, video, connection, etc.)"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none transition ${inputBg}`}
                />
                <button
                  onClick={submitReport}
                  disabled={!reportText.trim()}
                  className="w-full bg-red-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-red-500 disabled:opacity-40 transition active:scale-95"
                >
                  Submit report
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .safe-top { padding-top: env(safe-area-inset-top); }
        .pb-safe { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

interface SheetRowProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  chevron?: boolean;
  danger?: boolean;
  textPrimary: string;
  textSecondary: string;
  rowHover: string;
}

const SheetRow = ({ icon, label, onClick, active, chevron, danger, textPrimary, textSecondary, rowHover }: SheetRowProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition active:scale-[0.99] ${rowHover}`}
  >
    <span className={`flex-shrink-0 ${active ? 'text-purple-500' : danger ? 'text-red-500' : textSecondary}`}>
      {icon}
    </span>
    <span className={`flex-1 text-sm ${danger ? 'text-red-500' : textPrimary}`}>{label}</span>
    {active && <span className="text-[10px] font-semibold text-purple-500 uppercase">On</span>}
    {chevron && <ChevronRight size={16} className={textSecondary} />}
  </button>
);
export default MeetingRoom;