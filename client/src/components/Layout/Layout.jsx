import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Close menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner container">
          <NavLink to="/" className="header-brand" onClick={() => setIsMenuOpen(false)}>
            <img src="/logo.png" alt="CSE Football Club" className="brand-logo-img" />
            <div className="brand-info">
              <h1 className="brand-name">PunchDad</h1>
              <span className="brand-tag">CSE FC · HCMUT</span>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="header-nav desktop-nav">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Lịch đá</span>
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
          </nav>

          {/* User Profile & Corner Dropdown Menu */}
          <div className="header-user-wrapper" ref={menuRef}>
            <button
              ref={buttonRef}
              type="button"
              className={`user-menu-trigger ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-expanded={isMenuOpen}
              aria-label="Menu tài khoản"
              id="btn-user-menu"
              title="Menu tài khoản"
            >
              <div className="trigger-avatar-wrapper">
                <span className="user-avatar trigger-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user?.displayName} className="user-avatar-img" />
                  ) : (
                    user?.displayName?.[0]?.toUpperCase() || 'U'
                  )}
                </span>
                <span className={`trigger-chevron-badge ${isMenuOpen ? 'open' : ''}`}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
              </div>
            </button>

            {/* Floating Dropdown Card at Top-Right Corner */}
            {isMenuOpen && (
              <div className="user-menu-dropdown animate-pop-in" id="user-menu-dropdown">
                {/* Interactive Profile Card at top (navigates directly to profile, eliminating duplicate links) */}
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `menu-user-card ${isActive ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                  id="menu-link-profile-card"
                  title="Xem trang cá nhân"
                >
                  <div className="menu-avatar">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.displayName} className="menu-avatar-img" />
                    ) : (
                      user?.displayName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="menu-user-meta">
                    <h4 className="menu-user-name">{user?.displayName}</h4>
                    <div className="menu-user-sub">
                      <span className="menu-user-tag">@{user?.username}</span>
                      {user?.role === 'ADMIN' && <span className="badge badge-admin badge-xs">Admin</span>}
                    </div>
                  </div>
                  <div className="menu-user-chevron">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </NavLink>

                {/* Navigation shown only on Mobile (since desktop already has them in the header bar) */}
                <div className="menu-mobile-nav">
                  <div className="menu-divider" />
                  <NavLink
                    to="/"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                    end
                    id="menu-link-dashboard"
                  >
                    <div className="menu-item-icon-box">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <span className="menu-item-text">Lịch đá</span>
                    <svg className="menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </NavLink>

                  {user?.role === 'ADMIN' && (
                    <NavLink
                      to="/sessions/new"
                      className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setIsMenuOpen(false)}
                      id="menu-link-create-session"
                    >
                      <div className="menu-item-icon-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </div>
                      <span className="menu-item-text">Tạo buổi đá mới</span>
                      <svg className="menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </NavLink>
                  )}

                  <NavLink
                    to="/members"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                    id="menu-link-members"
                  >
                    <div className="menu-item-icon-box">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <span className="menu-item-text">Danh sách thành viên</span>
                    <svg className="menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </NavLink>
                </div>

                <div className="menu-divider" />

                {/* Logout Button */}
                <button
                  type="button"
                  className="menu-item menu-item-logout"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  id="menu-btn-logout"
                >
                  <div className="menu-item-icon-box logout-icon-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </div>
                  <span className="menu-item-text">Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
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
