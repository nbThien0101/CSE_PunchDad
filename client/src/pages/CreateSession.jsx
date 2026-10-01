import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import './CreateSession.css';

export default function CreateSession() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    playDate: '',
    location: '',
    googleMapsUrl: '',
    minPlayers: 6,
    maxPlayers: 14,
    voteDeadline: '',
  });
  const [timeSlots, setTimeSlots] = useState([
    { startTime: '17:00', endTime: '19:00' },
  ]);
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
        startTime: timeSlots[0].startTime,
        endTime: timeSlots[0].endTime,
        timeSlots,
        minPlayers: parseInt(form.minPlayers),
        maxPlayers: parseInt(form.maxPlayers),
        voteDeadline: form.voteDeadline || undefined,
        googleMapsUrl: form.googleMapsUrl.trim() || undefined,
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

  const updateTimeSlot = (index, field, value) => {
    setTimeSlots(prev => prev.map((slot, slotIndex) => (
      slotIndex === index ? { ...slot, [field]: value } : slot
    )));
  };

  const addTimeSlot = () => {
    const previous = timeSlots[timeSlots.length - 1];
    setTimeSlots(prev => [...prev, { startTime: previous?.endTime || '', endTime: '' }]);
  };

  const removeTimeSlot = (index) => {
    if (timeSlots.length === 1) return;
    setTimeSlots(prev => prev.filter((_, slotIndex) => slotIndex !== index));
  };

  // Generate today's date in local time as minDate (allows creating session for today or future dates)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const minDate = `${year}-${month}-${day}`;

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

        <div className="form-group time-slots-field">
          <div className="time-slots-heading">
            <div>
              <label className="form-label">Các khung giờ để bình chọn</label>
              <span className="form-hint">Thành viên có thể chọn một hoặc nhiều khung giờ phù hợp.</span>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={addTimeSlot}>
              + Thêm khung giờ
            </button>
          </div>
          <div className="time-slots-editor">
            {timeSlots.map((slot, index) => (
              <div className="time-slot-editor-row" key={index}>
                <span className="time-slot-number">{index + 1}</span>
                <div className="form-group">
                  <label className="form-label" htmlFor={`start-time-${index}`}>Bắt đầu</label>
                  <input
                    id={`start-time-${index}`}
                    type="time"
                    className="form-input"
                    value={slot.startTime}
                    onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor={`end-time-${index}`}>Kết thúc</label>
                  <input
                    id={`end-time-${index}`}
                    type="time"
                    className="form-input"
                    value={slot.endTime}
                    onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm time-slot-remove"
                  onClick={() => removeTimeSlot(index)}
                  disabled={timeSlots.length === 1}
                  aria-label={`Xóa khung giờ ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
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

        <div className="form-group">
          <label className="form-label" htmlFor="google-maps-url">
            Link Google Maps <span className="text-muted">(tùy chọn)</span>
          </label>
          <input
            id="google-maps-url"
            name="googleMapsUrl"
            type="url"
            className="form-input"
            placeholder="https://maps.app.goo.gl/..."
            value={form.googleMapsUrl}
            onChange={handleChange}
          />
          <span className="form-hint">Dán link chia sẻ từ Google Maps để mở đúng vị trí sân.</span>
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
