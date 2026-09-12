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
            <img src="/logo.png" alt="CSE Football Club" className="brand-logo-img" />
            <div className="brand-info">
              <h1 className="brand-name">PunchDad</h1>
              <span className="brand-tag">CSE FC · HCMUT</span>
            </div>
          </NavLink>

          <nav className="header-nav">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Lịch đấu</span>
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/sessions/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Tạo mới</span>
              </NavLink>
            )}
            <NavLink to="/members" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Thành viên</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Tài khoản</span>
            </NavLink>
          </nav>

          <div className="header-user">
            <div className="user-info">
              <span className="user-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.displayName} className="user-avatar-img" />
                ) : (
                  user?.displayName?.[0]?.toUpperCase()
                )}
              </span>
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
          <p>v1.2.1 · CSE PunchDad © 2026 · Built with ❤️ for the club</p>
        </div>
      </footer>
    </div>
  );
}
