import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Loader2,
  Users, X, Check
} from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import { getAllTasks, createTask, updateTaskStatus, deleteTask } from '../../services/taskService';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-500' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'review', label: 'Review', color: 'bg-yellow-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' }
];

const Workspace = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingToColumn, setAddingToColumn] = useState('');
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', assigneeName: '' });
  const [draggedTask, setDraggedTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const colBg = isDark ? 'bg-gray-900' : 'bg-gray-100';

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await getAllTasks();
      setTasks(response.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const response = await createTask({
        ...newTask,
        status: addingToColumn
      });
      setTasks(prev => [response.task, ...prev]);
      setNewTask({ title: '', priority: 'medium', assigneeName: '' });
      setShowAddTask(false);
      setAddingToColumn('');
    } catch (err) {
      console.error('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {}
  };

  const handleDragStart = (task: any) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === columnId) return;

    try {
      await updateTaskStatus(draggedTask._id, columnId);
      setTasks(prev =>
        prev.map(t => t._id === draggedTask._id ? { ...t, status: columnId } : t)
      );
    } catch (err) {}
    setDraggedTask(null);
  };

  const getTasksByStatus = (status: string) =>
    tasks.filter(t => t.status === status);

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return isDark ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-600';
    if (priority === 'medium') return isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-600';
    return isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-600';
  };

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>

      {/* Header */}
      <div className={`${cardBg} border-b px-6 py-4 sticky top-0 z-10`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                📋 Team Workspace
              </h1>
              <p className={`text-xs ${textSecondary}`}>Drag and drop tasks across columns</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${textSecondary}`}>{tasks.length} total tasks</span>
            <button
              onClick={() => { setShowAddTask(true); setAddingToColumn('todo'); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-500 transition flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={16} /> Add Task
            </button>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`${cardBg} border rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold ${textPrimary}`}>New Task</h3>
              <button onClick={() => setShowAddTask(false)} className={textSecondary}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title..."
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900'
                }`}
                autoFocus
              />

              <input
                type="text"
                value={newTask.assigneeName}
                onChange={(e) => setNewTask({ ...newTask, assigneeName: e.target.value })}
                placeholder="Assign to (name)..."
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900'
                }`}
              />

              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(p => (
                  <button
                    key={p}
                    onClick={() => setNewTask({ ...newTask, priority: p })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition border ${
                      newTask.priority === p
                        ? p === 'high'
                          ? 'bg-red-600 border-red-600 text-white'
                          : p === 'medium'
                          ? 'bg-yellow-500 border-yellow-500 text-white'
                          : 'bg-green-600 border-green-600 text-white'
                        : isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <select
                value={addingToColumn}
                onChange={(e) => setAddingToColumn(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                {COLUMNS.map(col => (
                  <option key={col.id} value={col.id}>{col.label}</option>
                ))}
              </select>

              <button
                onClick={handleAddTask}
                disabled={saving || !newTask.title.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition flex items-center justify-center gap-2 font-medium"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map(col => (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`${colBg} rounded-2xl p-4 min-h-96 transition-colors`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.color}`}></div>
                    <span className={`font-semibold text-sm ${textPrimary}`}>{col.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'
                    }`}>
                      {getTasksByStatus(col.id).length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setShowAddTask(true); setAddingToColumn(col.id); }}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                      isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                    }`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Tasks */}
                <div className="space-y-3">
                  {getTasksByStatus(col.id).map(task => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className={`${cardBg} border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition group`}
                    >
                      {/* AI Badge */}
                      {task.isFromAI && (
                        <span className="text-xs bg-purple-500 bg-opacity-20 text-purple-400 px-2 py-0.5 rounded-full mb-2 inline-block">
                          🤖 AI Generated
                        </span>
                      )}

                      <p className={`text-sm font-medium ${textPrimary} mb-2`}>{task.title}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.assigneeName && (
                            <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                              <Users size={10} /> {task.assigneeName}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {task.dueDate && (
                        <p className={`text-xs ${textSecondary} mt-2`}>
                          📅 {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Empty state */}
                  {getTasksByStatus(col.id).length === 0 && (
                    <div className={`text-center py-8 border-2 border-dashed rounded-xl ${
                      isDark ? 'border-gray-800 text-gray-700' : 'border-gray-200 text-gray-300'
                    }`}>
                      <p className="text-xs">Drop tasks here</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Workspace;