import { useState, useCallback, useRef } from 'react';
import Modal from './Modal';
import { Button, Input } from '../ui/index.jsx';

export function useConfirmation() {
  const [state, setState] = useState({
    isOpen: false,
    title: 'Xác nhận',
    message: '',
    confirmLabel: 'Xác nhận',
    cancelLabel: 'Hủy',
    requiredText: '',
  });

  const [inputVal, setInputVal] = useState('');
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setInputVal('');

      if (typeof options === 'string') {
        setState({
          isOpen: true,
          title: 'Xác nhận',
          message: options,
          confirmLabel: 'Xác nhận',
          cancelLabel: 'Hủy',
          requiredText: '',
        });
      } else if (options && typeof options === 'object') {
        setState({
          isOpen: true,
          title: options.title || 'Xác nhận',
          message: options.message || '',
          confirmLabel: options.confirmLabel || 'Xác nhận',
          cancelLabel: options.cancelLabel || 'Hủy',
          requiredText: options.requiredText || '',
        });
      } else {
        resolve(true);
      }
    });
  }, []);

  const handleClose = useCallback((result) => {
    setState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const isConfirmDisabled = state.requiredText
    ? inputVal.trim() !== state.requiredText.trim()
    : false;

  const confirmationDialog = state.isOpen ? (
    <Modal
      isOpen={state.isOpen}
      onClose={() => handleClose(false)}
      ariaLabel={state.title}
    >
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{state.title}</h2>
        <p>{state.message}</p>

        {state.requiredText && (
          <label>
            Vui lòng nhập <strong>{state.requiredText}</strong> để tiếp tục:
            <Input
              className="form-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Nhập ${state.requiredText}...`}
              autoFocus
            />
          </label>
        )}

        <div className="confirm-dialog-actions">
          <Button
            className="btn btn-outline"
            type="button"
            onClick={() => handleClose(false)}
          >
            {state.cancelLabel}
          </Button>

          <Button
            className="btn btn-primary"
            type="button"
            disabled={isConfirmDisabled}
            onClick={() => handleClose(true)}
          >
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmationDialog };
}

export default useConfirmation;
