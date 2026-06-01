import api from './api';

interface SignupData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

// Signup
export const signup = async (data: SignupData) => {
  const response = await api.post('/auth/signup', data);
  return response.data;
};

// Login
export const login = async (data: LoginData) => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

// Get profile
export const getProfile = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// Logout
export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};