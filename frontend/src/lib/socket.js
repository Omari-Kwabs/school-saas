import { io } from 'socket.io-client';

let socket = null;

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const SOCKET_URL = API_BASE.replace(/\/api$/, '') || window.location.origin;

export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
