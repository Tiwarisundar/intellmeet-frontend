import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';

const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    // Socket connect karo
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Socket connected:', socketRef.current?.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
    };
  }, [accessToken]);

  return socketRef.current;
};

export default useSocket;