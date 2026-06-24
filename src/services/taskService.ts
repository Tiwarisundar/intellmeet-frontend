import api from './api';

export const getAllTasks = async (filters?: any) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`/tasks?${params}`);
  return response.data;
};

export const createTask = async (data: any) => {
  const response = await api.post('/tasks', data);
  return response.data;
};

export const updateTask = async (id: string, data: any) => {
  const response = await api.put(`/tasks/${id}`, data);
  return response.data;
};

export const updateTaskStatus = async (id: string, status: string) => {
  const response = await api.put(`/tasks/${id}/status`, { status });
  return response.data;
};

export const deleteTask = async (id: string) => {
  const response = await api.delete(`/tasks/${id}`);
  return response.data;
};

export const bulkCreateTasks = async (tasks: any[], meetingId?: string) => {
  const response = await api.post('/tasks/bulk', { tasks, meetingId });
  return response.data;
};