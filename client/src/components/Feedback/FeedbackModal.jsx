import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from '../Modal/Modal';
import { feedbackAPI } from '../../services/api';
import './Feedback.css';

const CATEGORIES = [
  { value: 'BUG', label: 'Báo lỗi', icon: '🐞' },
  { value: 'FEATURE', label: 'Đề xuất', icon: '💡' },
  { value: 'UX', label: 'Trải nghiệm', icon: '✨' },
  { value: 'OTHER', label: 'Khác', icon: '💬' },
];

const RATINGS = [
  { value: 1, emoji: '😞', label: 'Rất tệ' },
  { value: 2, emoji: '😕', label: 'Chưa tốt' },
  { value: 3, emoji: '😐', label: 'Bình thường' },
  { value: 4, emoji: '🙂', label: 'Tốt' },
  { value: 5, emoji: '😍', label: 'Rất tốt' },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const location = useLocation();
  const textareaRef = useRef(null);
  const [category, setCategory] = useState('UX');
  const [rating, setRating] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSubmitted(false);
    window.setTimeout(() => textareaRef.current?.focus(), 150);
  }, [isOpen]);

  const resetAndClose = () => {
    setCategory('UX');
    setRating(null);
    setMessage('');
    setError('');
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (cleanMessage.length < 10) {
      setError('Bạn mô tả thêm một chút nhé — tối thiểu 10 ký tự.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await feedbackAPI.create({
        category,
        rating,
        message: cleanMessage,
        pagePath: `${location.pathname}${location.search}`,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Chưa thể gửi phản hồi. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} className="feedback-modal-shell">
      <section className="feedback-modal" aria-labelledby="feedback-title">
        <button className="feedback-close" type="button" onClick={resetAndClose} aria-label="Đóng">
          <svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
        </button>

        {submitted ? (
          <div className="feedback-success">
            <div className="feedback-success-icon">
              <svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
            </div>
            <span className="feedback-eyebrow">Đã gửi thành công</span>
            <h2 id="feedback-title">Cảm ơn bạn đã góp ý!</h2>
            <p>Admin và đội ngũ phát triển đã nhận được phản hồi của bạn.</p>
            <button className="btn btn-primary" type="button" onClick={resetAndClose}>Hoàn tất</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="feedback-heading">
              <span className="feedback-heading-icon" aria-hidden="true">✦</span>
              <div>
                <span className="feedback-eyebrow">Cùng xây dựng PunchDad</span>
                <h2 id="feedback-title">Gửi phản hồi</h2>
                <p>Mỗi góp ý của bạn đều giúp trải nghiệm tốt hơn.</p>
              </div>
            </div>

            <fieldset className="feedback-fieldset">
              <legend>Bạn muốn chia sẻ điều gì?</legend>
              <div className="feedback-category-grid">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`feedback-category ${category === item.value ? 'active' : ''}`}
                    onClick={() => setCategory(item.value)}
                    aria-pressed={category === item.value}
                  >
                    <span>{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="feedback-fieldset">
              <legend>Trải nghiệm của bạn <span>(không bắt buộc)</span></legend>
              <div className="feedback-rating" role="radiogroup" aria-label="Mức độ hài lòng">
                {RATINGS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={rating === item.value ? 'active' : ''}
                    onClick={() => setRating(rating === item.value ? null : item.value)}
                    role="radio"
                    aria-checked={rating === item.value}
                    title={item.label}
                  >
                    <span>{item.emoji}</span><small>{item.label}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="feedback-message-label" htmlFor="feedback-message">
              Nội dung góp ý
              <textarea
                ref={textareaRef}
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
                placeholder={category === 'BUG' ? 'Bạn gặp lỗi gì? Các bước để lỗi xuất hiện...' : 'Hãy chia sẻ điều bạn muốn chúng mình cải thiện...'}
                rows="5"
                required
              />
              <span className="feedback-char-count">{message.length}/2000</span>
            </label>

            {error && <div className="feedback-error" role="alert">{error}</div>}

            <div className="feedback-actions">
              <span>Trang hiện tại sẽ được đính kèm để dễ kiểm tra.</span>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <><span className="feedback-spinner" />Đang gửi...</> : 'Gửi phản hồi'}
              </button>
            </div>
          </form>
        )}
      </section>
    </Modal>
  );
}
