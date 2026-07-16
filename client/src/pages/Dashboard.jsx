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
      setSessions(data.sessions || []);
    } catch (err) {
      setError('Không thể tải danh sách sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (sessionId, status) => {
    try {
      await votesAPI.cast({ sessionId, status });
      await fetchSessions();
    } catch (err) {
      setError('Vote thất bại');
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
          <h1 className="page-title">Xin chào, {user?.displayName}! 👋</h1>
          <p className="page-subtitle">Quản lý sessions đá bóng của CLB</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Link to="/sessions/new" className="btn btn-primary" id="btn-new-session">
            ➕ Tạo Session
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
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'active', label: 'Đang hoạt động' },
          { key: 'VOTING', label: '🗳️ Đang vote' },
          { key: 'COMPLETED', label: '✅ Hoàn thành' },
          { key: 'CANCELLED', label: '❌ Đã hủy' },
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
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-title">Chưa có session nào</p>
          <p>
            {filter !== 'all'
              ? 'Không tìm thấy session với bộ lọc này'
              : user?.role === 'ADMIN'
                ? 'Tạo session đầu tiên để bắt đầu!'
                : 'Chờ admin tạo session mới nhé!'
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
