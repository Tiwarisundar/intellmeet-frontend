import api from './api';

interface CreateMeetingData {
  title: string;
  description?: string;
  maxParticipants?: number;
}

// Create meeting
export const createMeeting = async (data: CreateMeetingData) => {
  const response = await api.post('/meetings/create', data);
  return response.data;
};

// Join meeting
export const joinMeeting = async (meetingCode: string) => {
  const response = await api.post('/meetings/join', { meetingCode });
  return response.data;
};

// Get all meetings
export const getAllMeetings = async () => {
  const response = await api.get('/meetings');
  return response.data;
};

// Get single meeting
export const getMeeting = async (id: string) => {
  const response = await api.get(`/meetings/${id}`);
  return response.data;
};

// End meeting
export const endMeeting = async (id: string) => {
  const response = await api.put(`/meetings/${id}/end`);
  return response.data;
};

// Delete meeting
export const deleteMeeting = async (id: string) => {
  const response = await api.delete(`/meetings/${id}`);
  return response.data;
};