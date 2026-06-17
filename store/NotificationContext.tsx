import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from './WalletContext';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, any>;
  read: boolean;
  timestamp: number;
}

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notif: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  unreadCount: 0,
  addNotification: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  clearNotifications: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { walletAddress } = useWallet();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notificationsRef = useRef<AppNotification[]>(notifications);

  // Keep ref up-to-date with notifications state to prevent stale closures in listeners
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const STORAGE_KEY = walletAddress ? `notifications_${walletAddress}` : 'notifications_guest';

  // Load notifications when STORAGE_KEY changes
  useEffect(() => {
    loadNotifications();
  }, [STORAGE_KEY]);

  // Set up subscription for new notifications
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onNewNotification', (notif: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
      addNotification(notif);
    });
    return () => subscription.remove();
  }, [STORAGE_KEY]);

  const loadNotifications = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setNotifications(JSON.parse(data));
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  const saveNotifications = async (newNotifs: AppNotification[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifs));
      setNotifications(newNotifs);
    } catch (e) {
      console.error('Failed to save notifications', e);
    }
  };

  const addNotification = async (notif: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(2, 15),
      read: false,
      timestamp: Date.now(),
    };
    const updated = [newNotif, ...notificationsRef.current];
    await saveNotifications(updated);
  };

  const markAsRead = async (id: string) => {
    const updated = notificationsRef.current.map(n => n.id === id ? { ...n, read: true } : n);
    await saveNotifications(updated);
  };

  const markAllAsRead = async () => {
    const updated = notificationsRef.current.map(n => ({ ...n, read: true }));
    await saveNotifications(updated);
  };

  const clearNotifications = async () => {
    await saveNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};
