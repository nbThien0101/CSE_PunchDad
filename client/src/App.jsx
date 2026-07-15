import { useAuth } from './context/AuthContext'
import './App.css'

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1>⚽ CSE PunchDad</h1>
          <span className="header-subtitle">Sports Club Manager</span>
        </div>
        {user && (
          <div className="header-user">
            <span className="user-greeting">
              Xin chào, <strong>{user.displayName}</strong>
              {user.role === 'ADMIN' && <span className="badge-admin">Admin</span>}
            </span>
            <button className="btn-logout" onClick={logout}>Đăng xuất</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {!user ? (
          <div className="welcome-message">
            <h2>Chào mừng đến với CSE PunchDad!</h2>
            <p>Hệ thống quản lý vote đá bóng & thanh toán cho câu lạc bộ.</p>
            <p className="text-muted">
              Frontend đã sẵn sàng. Auth pages sẽ được xây dựng trong Phase 3.
            </p>
          </div>
        ) : (
          <div className="welcome-message">
            <h2>Dashboard</h2>
            <p>Xin chào {user.displayName}! Dashboard sẽ được xây dựng trong Phase 3.</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>CSE PunchDad © 2025 - Sports Club Voting & Payment</p>
      </footer>
    </div>
  );
}

export default App
