import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/**
 * Universal Modal Portal Component
 * - Renders directly onto document.body via createPortal to break out of any parent CSS transform/overflow containing blocks.
 * - Completely covers the viewport (100vw x 100vh) over header, footer, background margins with full backdrop blur and dimming.
 * - Locks body and html scroll so scrolling outside never drags the modal or moves the background page.
 * - Supports Escape key and backdrop click to close.
 */
export default function Modal({
  isOpen = true,
  onClose,
  children,
  className = '',
  closeOnBackdrop = true,
  closeOnEsc = true
}) {
  useEffect(() => {
    if (!isOpen) return;

    // Lock page scroll
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');

    const handleKeyDown = (e) => {
      if (closeOnEsc && e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay animate-fade-in"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-wrapper ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
