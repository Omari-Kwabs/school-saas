import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from httpOnly cookie by asking the server
    client.get('/auth/me')
      .then(r => {
        setUser(r.data);
        if (r.data.school_id) connectSocket();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  function login(userData) {
    // Called after a successful login response — server sets the cookie
    setUser(userData);
    if (userData.school_id) connectSocket();
  }

  async function logout() {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch {
      // ignore errors; clear state regardless
    }
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
