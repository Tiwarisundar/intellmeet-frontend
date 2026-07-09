import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { getAllMeetings, createMeeting, joinMeeting, deleteMeeting } from '../../services/meetingService';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notificationService';
import { getAllTasks, createTask, updateTaskStatus, deleteTask } from '../../services/taskService';
import {
  Video, Link2, LogOut, Calendar, Clock, Users,
  Trash2, ArrowRight, Loader2, Bell, Search,
  Sun, Moon, Check, ChevronRight, Brain, Plus, X, Link as LinkIcon
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMeetings, setFetchingMeetings] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const taskBoardRef = useRef<HTMLDivElement>(null);

  // Task board state
  const [tasks, setTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    meetingId: '',
    assigneeName: ''
  });

  useEffect(() => {
    fetchMeetings();
    fetchNotifications();
    fetchTasks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const fetchNotifications = async () => {
    try {
      const response = await getNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const fetchTasks = async () => {
    try {
      setFetchingTasks(true);
      const response = await getAllTasks();
      setTasks(response.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks');
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {}
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

  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMeeting(id);
      setMeetings(prev => prev.filter(m => m._id !== id));
    } catch (err) {}
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const scrollToTaskBoard = () => {
    taskBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.meetingCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---- Task board handlers ----

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setTaskSubmitting(true);
    setTaskError('');
    try {
      const payload: any = {
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        assigneeName: newTask.assigneeName.trim() || undefined,
      };
      if (newTask.meetingId) payload.meetingId = newTask.meetingId;

      const response = await createTask(payload);
      setTasks(prev => [response.task, ...prev]);
      setNewTask({ title: '', description: '', priority: 'medium', meetingId: '', assigneeName: '' });
      setShowAddTask(false);
    } catch (err: any) {
      setTaskError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // optimistic update
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
    try {
      const response = await updateTaskStatus(taskId, newStatus);
      setTasks(prev => prev.map(t => t._id === taskId ? response.task : t));
    } catch (err) {
      console.error('Failed to update task status');
      setTasks(prevTasks); // revert on failure
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t._id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task');
      setTasks(prevTasks); // revert on failure
    }
  };

  // Task board derived lists
  // Matches your actual Task schema enum: ['todo', 'in-progress', 'review', 'done']
  const getAssigneeName = (task: any) => task.assigneeName || 'Unassigned';
  const getMeetingLabel = (task: any) => {
    if (!task.meetingId) return null;
    // meetingId may be populated object or raw string id
    if (typeof task.meetingId === 'object') return task.meetingId.title;
    return null;
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const completedTasks = tasks.filter(t => t.status === 'done');

  const STATUS_OPTIONS = [
    { value: 'todo', label: 'Todo' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'review', label: 'Review' },
    { value: 'done', label: 'Completed' },
  ];

  const getPriorityDot = (priority: string) => {
    if (priority === 'high') return 'bg-red-500';
    if (priority === 'low') return 'bg-gray-400';
    return 'bg-yellow-500';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700';
    if (status === 'ended') return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500';
    return isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700';
  };

  const getNotifIcon = (type: string) => {
    const icons: Record<string, string> = {
      meeting_invite: '📨',
      meeting_started: '🎥',
      meeting_ended: '🔴',
      action_item: '✅',
      mention: '💬',
      task_assigned: '📋'
    };
    return icons[type] || '🔔';
  };

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-200 text-gray-900';
  const selectBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900';

  // Reusable task card
  const TaskCard = ({ task }: { task: any }) => {
    const meetingLabel = getMeetingLabel(task);
    return (
      <div className={`p-3 rounded-xl border ${isDark ? 'border-gray-800 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${textPrimary}`}>{task.title}</p>
          <button
            onClick={() => handleDeleteTask(task._id)}
            className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition ${
              isDark ? 'text-gray-500 hover:bg-red-950 hover:text-red-400' : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
            }`}
            title="Delete task"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {task.description && (
          <p className={`text-xs mt-1 ${textSecondary} line-clamp-2`}>{task.description}</p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`w-2 h-2 rounded-full ${getPriorityDot(task.priority)}`}></span>
          <span className={`text-xs ${textSecondary}`}>{getAssigneeName(task)}</span>
        </div>

        {meetingLabel && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            <LinkIcon size={11} />
            <span className="truncate">{meetingLabel}</span>
          </div>
        )}

        <select
          value={task.status}
          onChange={(e) => handleStatusChange(task._id, e.target.value)}
          className={`mt-3 w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectBg}`}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-200`}>

      {/* Navbar */}
      <nav className={`${cardBg} border-b sticky top-0 z-20 shadow-sm px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🤖</span>
            </div>
            <h1 className={`text-xl font-bold ${textPrimary}`}>IntellMeet</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                isDark
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition relative ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className={`absolute right-0 top-12 w-80 ${cardBg} border rounded-2xl shadow-xl z-50 overflow-hidden`}>
                  <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} flex items-center justify-between`}>
                    <span className={`font-semibold text-sm ${textPrimary}`}>
                      Notifications
                      {unreadCount > 0 && <span className="text-blue-500 ml-1">({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Check size={12} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell size={28} className={`mx-auto mb-2 ${textSecondary}`} />
                        <p className={`text-sm ${textSecondary}`}>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                          className={`p-4 border-b cursor-pointer transition ${
                            isDark
                              ? 'border-gray-800 hover:bg-gray-800'
                              : 'border-gray-50 hover:bg-gray-50'
                          } ${!notif.isRead ? (isDark ? 'bg-blue-950' : 'bg-blue-50') : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{getNotifIcon(notif.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${textPrimary}`}>{notif.title}</p>
                              <p className={`text-xs mt-0.5 ${textSecondary} truncate`}>{notif.message}</p>
                              <p className={`text-xs mt-1 ${textSecondary}`}>
                                {new Date(notif.createdAt).toLocaleString()}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className={`p-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} text-center`}>
                    <button className="text-xs text-blue-500 hover:text-blue-600">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <button
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={`text-sm font-medium ${textPrimary}`}>{user?.name}</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">
                Good day, {user?.name?.split(' ')[0]}! 👋
              </h2>
              <p className="text-blue-100 text-sm">Ready to collaborate? Start or join a meeting.</p>
              <button
                onClick={() => navigate('/post-meeting')}
                className="mt-3 flex items-center gap-2 bg-white bg-opacity-15 hover:bg-opacity-25 text-white text-sm px-4 py-2 rounded-xl transition"
              >
                <Brain size={16} /> AI Meeting Intelligence
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-15 rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">{meetings.length}</div>
                <div className="text-xs text-blue-100">Total</div>
              </div>
              <div className="bg-white bg-opacity-15 rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">
                  {meetings.filter(m => m.status === 'active').length}
                </div>
                <div className="text-xs text-blue-100">Active</div>
              </div>
              <div className="bg-white bg-opacity-15 rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">
                  {meetings.filter(m => m.status === 'ended').length}
                </div>
                <div className="text-xs text-blue-100">Ended</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Workspace', icon: '📋', path: '/workspace', color: 'from-blue-500 to-blue-600' },
            { label: 'Tasks', icon: '✅', path: null, action: () => { setShowAddTask(true); setTaskError(''); }, color: 'from-green-500 to-green-600' },
            { label: 'AI Intelligence', icon: '🤖', path: '/post-meeting', color: 'from-purple-500 to-purple-600' },
            { label: 'Profile', icon: '👤', path: '/profile', color: 'from-orange-500 to-orange-600' }
          ].map(link => (
            <button
              key={link.label}
              onClick={() => link.action ? link.action() : navigate(link.path!)}
              className={`bg-gradient-to-r ${link.color} text-white p-4 rounded-2xl text-left hover:opacity-90 transition shadow-sm`}
            >
              <div className="text-2xl mb-1">{link.icon}</div>
              <div className="font-semibold text-sm">{link.label}</div>
            </button>
          ))}
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
            className={`p-6 rounded-2xl text-left transition border-2 ${
              showCreate
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                : `${cardBg} border hover:border-blue-300 hover:shadow-md`
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              showCreate ? 'bg-white bg-opacity-20' : isDark ? 'bg-blue-900' : 'bg-blue-100'
            }`}>
              <Video size={24} className={showCreate ? 'text-white' : 'text-blue-600'} />
            </div>
            <div className={`font-bold text-lg mb-1 ${showCreate ? 'text-white' : textPrimary}`}>
              New Meeting
            </div>
            <div className={`text-sm ${showCreate ? 'text-blue-100' : textSecondary}`}>
              Start an instant video meeting
            </div>
          </button>

          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
            className={`p-6 rounded-2xl text-left transition border-2 ${
              showJoin
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                : `${cardBg} border hover:border-indigo-300 hover:shadow-md`
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              showJoin ? 'bg-white bg-opacity-20' : isDark ? 'bg-indigo-900' : 'bg-indigo-100'
            }`}>
              <Link2 size={24} className={showJoin ? 'text-white' : 'text-indigo-600'} />
            </div>
            <div className={`font-bold text-lg mb-1 ${showJoin ? 'text-white' : textPrimary}`}>
              Join Meeting
            </div>
            <div className={`text-sm ${showJoin ? 'text-indigo-100' : textSecondary}`}>
              Enter a meeting code to join
            </div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-4 text-sm flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className={`${cardBg} border rounded-2xl p-6 shadow-sm mb-6`}>
            <h3 className={`font-bold ${textPrimary} mb-4 flex items-center gap-2`}>
              <Video size={18} className="text-blue-600" /> Create New Meeting
            </h3>
            <form onSubmit={handleCreateMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title..."
                className={`flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
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
          <div className={`${cardBg} border rounded-2xl p-6 shadow-sm mb-6`}>
            <h3 className={`font-bold ${textPrimary} mb-4 flex items-center gap-2`}>
              <Link2 size={18} className="text-indigo-600" /> Join a Meeting
            </h3>
            <form onSubmit={handleJoinMeeting} className="flex gap-3">
              <input
                type="text"
                required
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="Enter meeting code (e.g. abc-defg-hij)"
                className={`flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
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

        {/* Task Board: Todo / In Progress / Review / Completed */}
        <div ref={taskBoardRef} className="flex items-center justify-between mb-4 scroll-mt-24">
          <h3 className={`font-bold ${textPrimary} flex items-center gap-2`}>
            <Check size={20} className="text-blue-600" /> Task Board
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          {/* Todo Column */}
          <div className={`${cardBg} border rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <h3 className={`font-bold text-sm ${textPrimary}`}>Todo</h3>
              <span className={`text-xs ${textSecondary}`}>({todoTasks.length})</span>
            </div>
            <div className="space-y-3">
              {fetchingTasks ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                </div>
              ) : todoTasks.length === 0 ? (
                <p className={`text-xs ${textSecondary}`}>No tasks</p>
              ) : (
                todoTasks.map((task: any) => <TaskCard key={task._id} task={task} />)
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className={`${cardBg} border rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className={`font-bold text-sm ${textPrimary}`}>In Progress</h3>
              <span className={`text-xs ${textSecondary}`}>({inProgressTasks.length})</span>
            </div>
            <div className="space-y-3">
              {fetchingTasks ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                </div>
              ) : inProgressTasks.length === 0 ? (
                <p className={`text-xs ${textSecondary}`}>No tasks</p>
              ) : (
                inProgressTasks.map((task: any) => <TaskCard key={task._id} task={task} />)
              )}
            </div>
          </div>

          {/* Review Column */}
          <div className={`${cardBg} border rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <h3 className={`font-bold text-sm ${textPrimary}`}>Review</h3>
              <span className={`text-xs ${textSecondary}`}>({reviewTasks.length})</span>
            </div>
            <div className="space-y-3">
              {fetchingTasks ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                </div>
              ) : reviewTasks.length === 0 ? (
                <p className={`text-xs ${textSecondary}`}>No tasks</p>
              ) : (
                reviewTasks.map((task: any) => <TaskCard key={task._id} task={task} />)
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className={`${cardBg} border rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              <h3 className={`font-bold text-sm ${textPrimary}`}>Completed</h3>
              <span className={`text-xs ${textSecondary}`}>({completedTasks.length})</span>
            </div>
            <div className="space-y-3">
              {fetchingTasks ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                </div>
              ) : completedTasks.length === 0 ? (
                <p className={`text-xs ${textSecondary}`}>No tasks</p>
              ) : (
                completedTasks.map((task: any) => <TaskCard key={task._id} task={task} />)
              )}
            </div>
          </div>

        </div>

        {/* Meetings List */}
        <div className={`${cardBg} border rounded-2xl shadow-sm`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} flex items-center justify-between flex-wrap gap-3`}>
            <h3 className={`font-bold ${textPrimary} flex items-center gap-2`}>
              <Calendar size={20} className="text-blue-600" /> Recent Meetings
            </h3>
            <div className="relative">
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className={`border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 ${inputBg}`}
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
                <div className={`w-16 h-16 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Calendar size={32} className={textSecondary} />
                </div>
                <p className={`${textPrimary} font-medium`}>No meetings found</p>
                <p className={`${textSecondary} text-sm mt-1`}>Start a new meeting to get going!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMeetings.map((meeting: any) => (
                  <div
                    key={meeting._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition group ${
                      isDark
                        ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800'
                        : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-900' : 'bg-blue-50'}`}>
                        <Video size={20} className="text-blue-500" />
                      </div>
                      <div>
                        <p className={`font-semibold ${textPrimary}`}>{meeting.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                            <Clock size={11} />
                            {new Date(meeting.createdAt).toLocaleDateString()}
                          </span>
                          <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                            <Users size={11} />
                            {meeting.participants?.length || 0}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(meeting.status)}`}>
                            {meeting.status}
                          </span>
                          <span className={`text-xs font-mono ${textSecondary}`}>
                            {meeting.meetingCode}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                      {meeting.status !== 'ended' ? (
                        <button
                          onClick={() => navigate(`/meeting/${meeting._id}`)}
                          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-1"
                        >
                          Join <ChevronRight size={14} />
                        </button>
                      ) : (
                        <span className={`text-xs px-3 py-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                          Ended
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteMeeting(meeting._id, e)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                          isDark ? 'bg-red-950 text-red-400 hover:bg-red-900' : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddTask(false)}
        >
          <div
            className={`${cardBg} border rounded-2xl p-6 w-full max-w-md shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className={`font-bold text-lg ${textPrimary}`}>Add New Task</h3>
              <button
                onClick={() => setShowAddTask(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {taskError && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">
                ⚠️ {taskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className={`text-xs font-medium ${textSecondary} mb-1 block`}>Title *</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Follow up with client"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                />
              </div>

              <div>
                <label className={`text-xs font-medium ${textSecondary} mb-1 block`}>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional details..."
                  rows={2}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${inputBg}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium ${textSecondary} mb-1 block`}>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectBg}`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-medium ${textSecondary} mb-1 block`}>Assignee</label>
                  <input
                    type="text"
                    value={newTask.assigneeName}
                    onChange={(e) => setNewTask({ ...newTask, assigneeName: e.target.value })}
                    placeholder="Name"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-xs font-medium ${textSecondary} mb-1 block flex items-center gap-1`}>
                  <LinkIcon size={12} /> Link to Meeting (optional)
                </label>
                <select
                  value={newTask.meetingId}
                  onChange={(e) => setNewTask({ ...newTask, meetingId: e.target.value })}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectBg}`}
                >
                  <option value="">No meeting</option>
                  {meetings.map((m: any) => (
                    <option key={m._id} value={m._id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={taskSubmitting || !newTask.title.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 font-medium"
              >
                {taskSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {taskSubmitting ? 'Adding...' : 'Add Task'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;