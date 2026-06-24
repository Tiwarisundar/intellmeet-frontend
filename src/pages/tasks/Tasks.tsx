import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Loader2,
  CheckSquare, Clock, Users, X, Check,
  Filter, Search
} from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import { getAllTasks, createTask, updateTaskStatus, deleteTask } from '../../services/taskService';

const Tasks = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigneeName: '',
    dueDate: ''
  });

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-200 text-gray-900';

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await getAllTasks();
      setTasks(response.tasks || []);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const response = await createTask(newTask);
      setTasks(prev => [response.task, ...prev]);
      setNewTask({ title: '', description: '', priority: 'medium', assigneeName: '', dueDate: '' });
      setShowAdd(false);
    } catch (err) {} finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await updateTaskStatus(taskId, status);
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status } : t));
    } catch (err) {}
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {}
  };

  const filteredTasks = tasks.filter(t => {
    const matchesFilter = filter === 'all' || t.status === filter || t.priority === filter;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assigneeName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return isDark ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-600';
    if (priority === 'medium') return isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-600';
    return isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-600';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      'todo': isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600',
      'in-progress': isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600',
      'review': isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-600',
      'done': isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-600'
    };
    return map[status] || '';
  };

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>

      {/* Header */}
      <div className={`${cardBg} border-b px-6 py-4 sticky top-0 z-10`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                <CheckSquare size={20} className="text-blue-500" /> Task Management
              </h1>
              <p className={`text-xs ${textSecondary}`}>Manage and track all your tasks</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-500 transition flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-blue-500' },
            { label: 'To Do', value: stats.todo, color: 'text-gray-500' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-blue-500' },
            { label: 'Done', value: stats.done, color: 'text-green-500' }
          ].map(stat => (
            <div key={stat.label} className={`${cardBg} border rounded-2xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className={`text-xs ${textSecondary} mt-1`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className={`w-full border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={15} className={textSecondary} />
            {['all', 'todo', 'in-progress', 'done', 'high', 'medium', 'low'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-xl capitalize transition ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className={`${cardBg} border rounded-2xl overflow-hidden`}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare size={40} className={`mx-auto mb-3 ${textSecondary}`} />
              <p className={`font-medium ${textPrimary}`}>No tasks found</p>
              <p className={`text-sm ${textSecondary} mt-1`}>Create a new task to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredTasks.map((task) => (
                <div key={task._id} className={`p-4 flex items-center gap-4 group hover:${isDark ? 'bg-gray-800' : 'bg-gray-50'} transition`}>

                  {/* Checkbox */}
                  <button
                    onClick={() => handleStatusChange(task._id, task.status === 'done' ? 'todo' : 'done')}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                      task.status === 'done'
                        ? 'bg-green-500 border-green-500'
                        : isDark ? 'border-gray-600 hover:border-green-400' : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {task.status === 'done' && <Check size={12} className="text-white" />}
                  </button>

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : textPrimary}`}>
                      {task.title}
                      {task.isFromAI && <span className="ml-2 text-xs text-purple-400">🤖 AI</span>}
                    </p>
                    {task.description && (
                      <p className={`text-xs ${textSecondary} mt-0.5 truncate`}>{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusBadge(task.status)}`}>
                        {task.status.replace('-', ' ')}
                      </span>
                      {task.assigneeName && (
                        <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                          <Users size={10} /> {task.assigneeName}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                          <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Change */}
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task._id, e.target.value)}
                    className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none opacity-0 group-hover:opacity-100 transition ${inputBg}`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(task._id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`${cardBg} border rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold ${textPrimary}`}>New Task</h3>
              <button onClick={() => setShowAdd(false)} className={textSecondary}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title *"
                autoFocus
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Description (optional)"
                rows={3}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${inputBg}`}
              />
              <input
                type="text"
                value={newTask.assigneeName}
                onChange={(e) => setNewTask({ ...newTask, assigneeName: e.target.value })}
                placeholder="Assign to..."
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
              />
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
              />
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(p => (
                  <button
                    key={p}
                    onClick={() => setNewTask({ ...newTask, priority: p })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition ${
                      newTask.priority === p
                        ? p === 'high' ? 'bg-red-600 border-red-600 text-white'
                          : p === 'medium' ? 'bg-yellow-500 border-yellow-500 text-white'
                          : 'bg-green-600 border-green-600 text-white'
                        : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleAddTask}
                disabled={saving || !newTask.title.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;