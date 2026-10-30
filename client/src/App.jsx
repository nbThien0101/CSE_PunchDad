import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const CreateSession = lazy(() => import('./pages/CreateSession'));
const Profile = lazy(() => import('./pages/Profile'));
const Members = lazy(() => import('./pages/Members'));
const FeedbackAdmin = lazy(() => import('./pages/FeedbackAdmin'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentDetail = lazy(() => import('./pages/TournamentDetail'));
const Notices = lazy(() => import('./pages/Notices'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter><Suspense fallback={<div className="loading-screen"><div className="spinner" /><p>Đang tải giao diện…</p></div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route
            path="/sessions/new"
            element={<AdminRoute><CreateSession /></AdminRoute>}
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="/members" element={<Members />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/feedback" element={<AdminRoute><FeedbackAdmin /></AdminRoute>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense></BrowserRouter>
  );
}

export default App;
