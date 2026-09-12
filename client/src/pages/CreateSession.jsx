import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import './CreateSession.css';

export default function CreateSession() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    playDate: '',
    startTime: '17:00',
    endTime: '19:00',
    location: '',
    minPlayers: 6,
    maxPlayers: 14,
    voteDeadline: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...form,
        minPlayers: parseInt(form.minPlayers),
        maxPlayers: parseInt(form.maxPlayers),
        voteDeadline: form.voteDeadline || undefined,
      };
      const result = await sessionsAPI.create(data);
      if (result.error || result.errors) {
        setError(result.error || result.errors?.[0]?.msg || 'Tạo trận đấu thất bại');
      } else {
        navigate(`/sessions/${result.session.id}`);
      }
    } catch {
      setError('Tạo trận đấu thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Generate tomorrow's date as default min
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="create-session animate-fade-in">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} id="btn-back-create">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Quay lại
      </button>

      <div className="create-header">
        <h1 className="page-title">Tạo trận đấu mới</h1>
        <p className="page-subtitle">Khởi tạo lịch thi đấu và mở bình chọn cho các thành viên CLB</p>
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

      <form className="create-form card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="session-title">Tiêu đề trận đấu</label>
          <input
            id="session-title"
            name="title"
            type="text"
            className="form-input"
            placeholder="VD: Chiều thứ 7 (19/09/2026)"
            value={form.title}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label" htmlFor="play-date">Ngày thi đấu</label>
            <input
              id="play-date"
              name="playDate"
              type="date"
              className="form-input"
              min={minDate}
              value={form.playDate}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="start-time">Giờ bắt đầu</label>
            <input
              id="start-time"
              name="startTime"
              type="time"
              className="form-input"
              value={form.startTime}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="end-time">Giờ kết thúc</label>
            <input
              id="end-time"
              name="endTime"
              type="time"
              className="form-input"
              value={form.endTime}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="location">Địa điểm sân</label>
          <input
            id="location"
            name="location"
            type="text"
            className="form-input"
            placeholder="VD: Sân bóng Chảo Lửa, Quận Tân Bình"
            value={form.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="min-players">Số người tối thiểu</label>
            <input
              id="min-players"
              name="minPlayers"
              type="number"
              className="form-input"
              min="2"
              max="30"
              value={form.minPlayers}
              onChange={handleChange}
              required
            />
            <span className="form-hint">Đủ số lượng này hệ thống sẽ tự động chốt đủ người</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="max-players">Số người tối đa</label>
            <input
              id="max-players"
              name="maxPlayers"
              type="number"
              className="form-input"
              min="2"
              max="30"
              value={form.maxPlayers}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="vote-deadline">Hạn chót bình chọn <span className="text-muted">(tùy chọn)</span></label>
          <input
            id="vote-deadline"
            name="voteDeadline"
            type="datetime-local"
            className="form-input"
            value={form.voteDeadline}
            onChange={handleChange}
          />
          <span className="form-hint">Sau thời gian này, thành viên không thể thay đổi bình chọn</span>
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} id="btn-create-session">
          {loading ? <span className="spinner spinner-sm"></span> : null}
          {loading ? 'Đang khởi tạo...' : 'Tạo trận đấu'}
        </button>
      </form>
    </div>
  );
}
