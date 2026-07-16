import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner container">
          <NavLink to="/" className="header-brand">
            <span className="brand-icon">⚽</span>
            <div>
              <h1 className="brand-name">PunchDad</h1>
              <span className="brand-tag">Sports Club</span>
            </div>
          </NavLink>

          <nav className="header-nav">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <span className="nav-icon">📋</span>
              <span>Sessions</span>
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/sessions/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">➕</span>
                <span>Tạo mới</span>
              </NavLink>
            )}
            <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">👤</span>
              <span>Profile</span>
            </NavLink>
          </nav>

          <div className="header-user">
            <div className="user-info">
              <span className="user-avatar">{user?.displayName?.[0]?.toUpperCase()}</span>
              <div className="user-details">
                <span className="user-name">{user?.displayName}</span>
                {user?.role === 'ADMIN' && <span className="badge badge-admin">Admin</span>}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="btn-logout">
              Đăng xuất
            </button>
          </div>

          <button className="mobile-menu-btn" id="mobile-menu-toggle" onClick={() => {
            document.querySelector('.header-nav')?.classList.toggle('open');
          }}>
            ☰
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>CSE PunchDad © 2025 · Built with ❤️ for the club</p>
        </div>
      </footer>
    </div>
  );
}
