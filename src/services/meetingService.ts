import api from './api';

interface CreateMeetingData {
  title: string;
  description?: string;
  maxParticipants?: number;
}

interface GenerateAISummaryData {
  meetingId: string;
  transcript: string;
}

interface GetMeetingSummaryResponse {
  success: boolean;
  data: {
    meetingId: string;
    transcript: string;
    summary: string;
    keyPoints: string[];
    actionItems: {
      task: string;
      assigneeName: string;
      status: string;
      priority: string;
      completed: boolean;
    }[];
  };
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

// Generate AI Summary
export const generateAISummary = async (
  data: GenerateAISummaryData
) => {
  const response = await api.post(
    "/summaries/generate-ai",
    data
  );

  return response.data;
};

// Get Meeting Summary
export const getMeetingSummary = async (
  meetingId: string
): Promise<GetMeetingSummaryResponse> => {
  const response = await api.get(
    `/summaries/${meetingId}`
  );

  return response.data;
};

// Save Transcript
export const saveTranscript = async (
  meetingId: string,
  transcript: string
) => {
  const response = await api.post(
    "/summaries/save-transcript",
    {
      meetingId,
      transcript,
    }
  );

  return response.data;
};

// Get all tasks
export const getTasks = async () => {
  const response = await api.get("/tasks");
  return response.data;
};

export const updateTask = async (
  id: string,
  status: string
) => {
  const response = await api.put(`/tasks/${id}`, {
    status,
  });

  return response.data;
};