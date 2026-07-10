import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';

const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    // Socket connect karo
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('⚠️ Socket connection error:', err.message);
    });

    // Cleanup
    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [accessToken]);

  return socket;
};

export default useSocket;