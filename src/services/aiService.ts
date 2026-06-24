import api from './api';

// Meeting summary generate karo
export const generateMeetingSummary = async (meetingId: string, transcript: string) => {
  const response = await api.post('/ai/summary', { meetingId, transcript });
  return response.data;
};

// Action items extract karo
export const extractActionItems = async (transcript: string, participants: string[]) => {
  const response = await api.post('/ai/action-items', { transcript, participants });
  return response.data;
};

// Meeting summary get karo
export const getMeetingSummary = async (meetingId: string) => {
  const response = await api.get(`/ai/summary/${meetingId}`);
  return response.data;
};

// AI se sawal poocho
export const askAI = async (question: string, context?: string) => {
  const response = await api.post('/ai/chat', { question, context });
  return response.data;
};