import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import Layout from './components/Layout';

interface AuthContextType {
  token: string | null;
  guildId: string | null;
  login: (token: string, guildId: string) => void;
  logout: () => void;
  socket: Socket | null;
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  guildId: null,
  login: () => {},
  logout: () => {},
  socket: null,
});

export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [guildId, setGuildId] = useState<string | null>(localStorage.getItem('guildId'));
  const [socket, setSocket] = useState<Socket | null>(null);

  const login = (newToken: string, newGuildId: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('guildId', newGuildId);
    setToken(newToken);
    setGuildId(newGuildId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('guildId');
    setToken(null);
    setGuildId(null);
    socket?.disconnect();
    setSocket(null);
  };

  useEffect(() => {
    if (token) {
      const s = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
        auth: { token },
      });
      s.on('connect_error', () => {
        console.error('Socket bağlantı hatası');
      });
      setSocket(s);
      return () => { s.disconnect(); };
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, guildId, login, logout, socket }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/:id" element={<TicketDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
