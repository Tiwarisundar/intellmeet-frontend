import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { getAllMeetings, createMeeting, joinMeeting, deleteMeeting } from '../../services/meetingService';
import {
  Video, Link2, Plus, LogOut, Calendar,
  Clock, Users, Trash2, ArrowRight, Loader2,
  Bell, Search
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMeetings, setFetchingMeetings] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchMeetings(); }, []);

  const fetchMeetings = async () => {
    try {
      setFetchingMeetings(true);
      const response = await getAllMeetings();
      setMeetings(response.meetings);
    } catch (err) {
      console.error('Failed to fetch meetings');
    } finally {
      setFetchingMeetings(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await createMeeting({ title: meetingTitle });
      navigate(`/meeting/${response.meeting.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await joinMeeting(meetingCode);
      navigate(`/meeting/${response.meeting.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Meeting not found');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await deleteMeeting(id);
      setMeetings(prev => prev.filter(m => m._id !== id));
    } catch (err) {
      console.error('Failed to delete');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.meetingCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'ended') return 'bg-red-100 text-red-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">IntellMeet</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">
                Good day, {user?.name?.split(' ')[0]}! 👋
              </h2>
              <p className="text-blue-100">Ready to collaborate? Start or join a meeting.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-white bg-opacity-20 rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">{meetings.length}</div>
                <div className="text-xs text-blue-100">Total Meetings</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">
                  {meetings.filter(m => m.status === 'active').length}
                </div>
                <div className="text-xs text-blue-100">Active</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
            className={`p-6 rounded-2xl text-left transition border-2 ${
              showCreate
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              showCreate ? 'bg-white bg-opacity-20' : 'bg-blue-100'
            }`}>
              <Video size={24} className={showCreate ? 'text-white' : 'text-blue-600'} />
            </div>
            <div className={`font-bold text-lg mb-1 ${showCreate ? 'text-white' : 'text-gray-900'}`}>
              New Meeting
            </div>
            <div className={`text-sm ${showCreate ? 'text-blue-100' : 'text-gray-500'}`}>
              Start an instant video meeting
            </div>
          </button>

          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
            className={`p-6 rounded-2xl text-left transition border-2 ${
              showJoin
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              showJoin ? 'bg-white bg-opacity-20' : 'bg-indigo-100'
            }`}>
              <Link2 size={24} className={showJoin ? 'text-white' : 'text-indigo-600'} />
            </div>
            <div className={`font-bold text-lg mb-1 ${showJoin ? 'text-white' : 'text-gray-900'}`}>
              Join Meeting
            </div>
            <div className={`text-sm ${showJoin ? 'text-indigo-100' : 'text-gray-500'}`}>
              Enter a meeting code to join
            </div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-4 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Create New Meeting
            </h3>
            <form onSubmit={handleCreateMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2 font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {loading ? 'Creating...' : 'Start'}
              </button>
            </form>
          </div>
        )}

        {/* Join Form */}
        {showJoin && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Link2 size={20} className="text-indigo-600" />
              Join a Meeting
            </h3>
            <form onSubmit={handleJoinMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="Enter meeting code (e.g. abc-defg-hij)"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2 font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {loading ? 'Joining...' : 'Join'}
              </button>
            </form>
          </div>
        )}

        {/* Recent Meetings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={20} className="text-blue-600" />
              Recent Meetings
            </h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meetings..."
                className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-6">
            {fetchingMeetings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No meetings yet</p>
                <p className="text-gray-400 text-sm mt-1">Start a new meeting to get going!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMeetings.map((meeting: any) => (
                  <div
                    key={meeting._id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Video size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{meeting.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> {new Date(meeting.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Users size={12} /> {meeting.participants?.length || 0}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(meeting.status)}`}>
                            {meeting.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                      <span className="text-xs text-gray-400 font-mono">{meeting.meetingCode}</span>
                      <button
                        onClick={() => navigate(`/meeting/${meeting._id}`)}
                        className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-1"
                      >
                        Join <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting._id)}
                        className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;