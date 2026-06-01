import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { getAllMeetings, createMeeting, joinMeeting } from '../../services/meetingService';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await getAllMeetings();
      setMeetings(response.meetings);
    } catch (err) {
      console.error('Failed to fetch meetings');
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
      setError(err.response?.data?.message || 'Failed to join meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">🤖 IntellMeet</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">👋 {user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6">

        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.name}! 👋
          </h2>
          <p className="text-gray-500 mt-1">Start or join a meeting</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            className="bg-blue-600 text-white p-6 rounded-2xl text-left hover:bg-blue-700 transition"
          >
            <div className="text-3xl mb-2">🎥</div>
            <div className="font-semibold text-lg">New Meeting</div>
            <div className="text-blue-200 text-sm">Start an instant meeting</div>
          </button>

          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
            className="bg-white border-2 border-blue-600 text-blue-600 p-6 rounded-2xl text-left hover:bg-blue-50 transition"
          >
            <div className="text-3xl mb-2">🔗</div>
            <div className="font-semibold text-lg">Join Meeting</div>
            <div className="text-blue-400 text-sm">Enter a meeting code</div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Create Meeting Form */}
        {showCreate && (
          <div className="bg-white rounded-2xl p-6 shadow mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Create New Meeting</h3>
            <form onSubmit={handleCreateMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Meeting title..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        )}

        {/* Join Meeting Form */}
        {showJoin && (
          <div className="bg-white rounded-2xl p-6 shadow mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Join a Meeting</h3>
            <form onSubmit={handleJoinMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="Enter meeting code (e.g. abc-defg-hij)"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join'}
              </button>
            </form>
          </div>
        )}

        {/* Recent Meetings */}
        <div className="bg-white rounded-2xl p-6 shadow">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Meetings</h3>
          {meetings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <p>No meetings yet — start one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting: any) => (
                <div
                  key={meeting._id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition"
                >
                  <div>
                    <p className="font-medium text-gray-800">{meeting.title}</p>
                    <p className="text-sm text-gray-400">
                      Code: {meeting.meetingCode} · {meeting.status}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/meeting/${meeting._id}`)}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    Join →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;