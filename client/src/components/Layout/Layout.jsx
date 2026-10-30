import { Badge, Button } from '../ui/index.jsx';
import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FeedbackModal from '../Feedback/FeedbackModal';
import { usersAPI, noticesAPI } from '../../services/api';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [pendingMembers, setPendingMembers] = useState(0);
  const [noticeSummary, setNoticeSummary] = useState({ unreadCount: 0, latestUnread: null });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const data = await noticesAPI.summary(); if (active) setNoticeSummary(data); }
      catch { /* The board remains available after connectivity returns. */ }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('club-notices-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('club-notices-changed', refresh); window.removeEventListener('focus', refresh); };
  }, []);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let active = true;
    const refresh = async () => {
      try {
        const data = await usersAPI.getMembershipRequestCount();
        if (active && !data.error) setPendingMembers(data.count || 0);
      } catch { /* The persisted inbox remains available when connectivity returns. */ }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('membership-requests-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('membership-requests-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.role]);
  
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
      {user?.role === 'ADMIN' && pendingMembers > 0 && (
        <NavLink to="/members#membership-requests" className="membership-notification" role="status">
          Có {pendingMembers} người đăng ký tham gia CLB đang chờ duyệt · Xem thông tin và duyệt
        </NavLink>
      )}
      <header className="header">
        <div className="header-inner container">
          <NavLink to="/" className="header-brand" onClick={() => setIsMenuOpen(false)}>
            <img src="/logo.svg" width="40" height="40" alt="HitDad · CSE Football Club" className="brand-logo-img" />
            <div className="brand-info">
              <h1 className="brand-name">HitDad</h1>
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
            <NavLink to="/tournaments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8" /></svg>
              <span>Giải đấu</span>
            </NavLink>
            <NavLink to="/notices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span>Thông báo{noticeSummary.unreadCount > 0 ? ` (${noticeSummary.unreadCount})` : ''}</span>
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
            {user?.role === 'ADMIN' && (
              <NavLink to="/feedback" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <svg className="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
                  <path d="M8 9h8M8 13h5"></path>
                </svg>
                <span>Phản hồi</span>
              </NavLink>
            )}
          </nav>

          {/* User Profile & Corner Dropdown Menu */}
          <div className="header-user-wrapper" ref={menuRef}>
            <Button
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
            </Button>

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
                      {user?.role === 'ADMIN' && <Badge className="badge badge-admin badge-xs">Admin</Badge>}
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
                  <NavLink to="/notices" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <span className="menu-item-text">Thông báo CLB{noticeSummary.unreadCount > 0 ? ` (${noticeSummary.unreadCount})` : ''}</span>
                  </NavLink>
                  <NavLink to="/tournaments" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <span className="menu-item-text">Giải đấu CLB</span>
                  </NavLink>
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

                  {user?.role === 'ADMIN' && (
                    <NavLink
                      to="/feedback"
                      className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setIsMenuOpen(false)}
                      id="menu-link-feedback"
                    >
                      <div className="menu-item-icon-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
                          <path d="M8 9h8M8 13h5"></path>
                        </svg>
                      </div>
                      <span className="menu-item-text">Quản lý phản hồi</span>
                      <svg className="menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </NavLink>
                  )}
                </div>

                <div className="menu-divider" />

                {/* Logout Button */}
                <Button
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
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {noticeSummary.unreadCount > 0 && <NavLink to="/notices" className="club-notice-banner" role="status">
        {noticeSummary.unreadCount} thông báo chưa đọc · {noticeSummary.latestUnread?.title} · Xem bảng tin →
      </NavLink>}
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>v1.2.4 · CSE HitDad © 2026 · Built with ❤️ for the club</p>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Điều hướng chính">
        <NavLink to="/" end>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>
          <span>Lịch đá</span>
        </NavLink>
        <NavLink to="/tournaments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8" /></svg>
          <span>Giải đấu</span>
        </NavLink>
        <NavLink to="/members">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/></svg>
          <span>Thành viên</span>
        </NavLink>
        {user?.role === 'ADMIN' && <NavLink to="/sessions/new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 7v10M7 12h10"/></svg>
          <span>Tạo trận</span>
        </NavLink>}
        <NavLink to="/profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
          <span>Tài khoản</span>
        </NavLink>
      </nav>

      <Button className="feedback-fab" type="button" onClick={() => setIsFeedbackOpen(true)} aria-label="Gửi phản hồi" title="Gửi phản hồi">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
          <path d="M8 9h8M8 13h5"></path>
        </svg>
        <span>Góp ý</span>
      </Button>
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
