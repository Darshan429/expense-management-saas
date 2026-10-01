import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

// Single socket instance — not recreated on re-render
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
  auth:       { token: localStorage.getItem('token') },
  autoConnect: false    // connect manually after login
});

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [connected,     setConnected]     = useState(false);

  // Connect socket — call this after user logs in
  const connectSocket = useCallback((token) => {
    socket.auth = { token };
    socket.connect();
  }, []);

  // Disconnect — call this on logout
  const disconnectSocket = useCallback(() => {
    socket.disconnect();
  }, []);

  useEffect(() => {
    // On mount — fetch notifications user missed while offline
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();

    // Socket event listeners
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Live notification arrives — prepend to list, increment badge
    socket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_notification');
    };
  }, []);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const markOneRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    connected,
    markAllRead,
    markOneRead,
    connectSocket,
    disconnectSocket
  };
}