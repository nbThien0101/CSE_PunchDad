import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionsAPI, votesAPI } from '../services/api';
import SessionCard from '../components/SessionCard/SessionCard';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await sessionsAPI.getAll();
      if (data?.error) {
        throw new Error(data.error);
      }
      setSessions(data.sessions || []);
    } catch (err) {
      setError('Không thể tải danh sách sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (sessionId, status) => {
    try {
      const res = await votesAPI.cast({ sessionId, status });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError('');
      await fetchSessions();
    } catch (err) {
      setError(err?.message || 'Vote thất bại');
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['VOTING', 'CONFIRMED', 'BOOKED'].includes(s.status);
    return s.status === filter;
  });

  const stats = {
    total: sessions.length,
    voting: sessions.filter(s => s.status === 'VOTING').length,
    confirmed: sessions.filter(s => s.status === 'CONFIRMED').length,
    booked: sessions.filter(s => s.status === 'BOOKED').length,
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Xin chào, {user?.displayName}</h1>
          <p className="page-subtitle">Quản lý lịch thi đấu và hoạt động của CLB</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Link to="/sessions/new" className="btn btn-primary" id="btn-new-session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Tạo trận đấu
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Tổng sessions</span>
        </div>
        <div className="stat-card stat-voting">
          <span className="stat-number">{stats.voting}</span>
          <span className="stat-label">Đang vote</span>
        </div>
        <div className="stat-card stat-confirmed">
          <span className="stat-number">{stats.confirmed}</span>
          <span className="stat-label">Đã đủ người</span>
        </div>
        <div className="stat-card stat-booked">
          <span className="stat-number">{stats.booked}</span>
          <span className="stat-label">Đã đặt sân</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'active', label: 'Đang mở' },
          { key: 'VOTING', label: 'Bình chọn' },
          { key: 'COMPLETED', label: 'Đã xong' },
          { key: 'CANCELLED', label: 'Đã hủy' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <p className="empty-state-title">Chưa có trận đấu nào</p>
          <p>
            {filter !== 'all'
              ? 'Không tìm thấy trận đấu với bộ lọc này'
              : user?.role === 'ADMIN'
                ? 'Tạo trận đấu đầu tiên để bắt đầu sinh hoạt cùng CLB!'
                : 'Chờ ban cán sự tạo lịch thi đấu mới nhé!'
            }
          </p>
        </div>
      ) : (
        <div className="sessions-grid stagger-children">
          {filteredSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              currentUser={user}
              onVote={handleVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
