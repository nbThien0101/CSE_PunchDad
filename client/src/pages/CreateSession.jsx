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
        setError(result.error || result.errors?.[0]?.msg || 'Tạo session thất bại');
      } else {
        navigate(`/sessions/${result.session.id}`);
      }
    } catch {
      setError('Tạo session thất bại');
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
        ← Quay lại
      </button>

      <div className="create-header">
        <h1 className="page-title">⚽ Tạo Session Mới</h1>
        <p className="page-subtitle">Tạo phiên đá bóng và mời thành viên vote</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <form className="create-form card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="session-title">Tiêu đề</label>
          <input
            id="session-title"
            name="title"
            type="text"
            className="form-input"
            placeholder="VD: Đá bóng chiều thứ 7"
            value={form.title}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label" htmlFor="play-date">📅 Ngày chơi</label>
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
            <label className="form-label" htmlFor="start-time">🕐 Bắt đầu</label>
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
            <label className="form-label" htmlFor="end-time">🕖 Kết thúc</label>
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
          <label className="form-label" htmlFor="location">📍 Địa điểm sân</label>
          <input
            id="location"
            name="location"
            type="text"
            className="form-input"
            placeholder="VD: Sân bóng ABC, Quận 1"
            value={form.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="min-players">👥 Tối thiểu</label>
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
            <span className="form-hint">Đủ số này sẽ tự confirm</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="max-players">👥 Tối đa</label>
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
          <label className="form-label" htmlFor="vote-deadline">⏰ Hạn vote <span className="text-muted">(tùy chọn)</span></label>
          <input
            id="vote-deadline"
            name="voteDeadline"
            type="datetime-local"
            className="form-input"
            value={form.voteDeadline}
            onChange={handleChange}
          />
          <span className="form-hint">Sau thời gian này, thành viên không thể vote nữa</span>
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} id="btn-create-session">
          {loading ? <span className="spinner spinner-sm"></span> : null}
          {loading ? 'Đang tạo...' : '⚽ Tạo Session'}
        </button>
      </form>
    </div>
  );
}
