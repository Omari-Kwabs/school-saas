import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';

const EVENTS = ['announcement', 'memo', 'payment', 'approval'];

/**
 * Subscribe to real-time school notifications.
 * @param {(event: string, payload: object) => void} onNotification
 */
export default function useNotifications(onNotification) {
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlers = {};
    EVENTS.forEach(event => {
      handlers[event] = (payload) => handlerRef.current(event, payload);
      socket.on(event, handlers[event]);
    });

    return () => {
      EVENTS.forEach(event => socket.off(event, handlers[event]));
    };
  }, []);
}
