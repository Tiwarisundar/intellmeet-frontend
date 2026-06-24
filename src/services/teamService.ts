import api from './api';

export const getAllTeams = async () => {
  const response = await api.get('/teams');
  return response.data;
};

export const createTeam = async (data: any) => {
  const response = await api.post('/teams', data);
  return response.data;
};

export const updateTeam = async (id: string, data: any) => {
  const response = await api.put(`/teams/${id}`, data);
  return response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await api.delete(`/teams/${id}`);
  return response.data;
};