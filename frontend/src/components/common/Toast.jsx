import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className={`toast-container ${isSuccess ? 'toast-success' : isError ? 'toast-error' : 'toast-info'}`}>
      <div className="toast-icon">
        {isSuccess && <CheckCircle2 size={20} />}
        {isError && <AlertCircle size={20} />}
        {!isSuccess && !isError && <Info size={20} />}
      </div>
      <div className="toast-content">
        <h4 className="toast-title">{toast.title || (isSuccess ? 'Success' : isError ? 'Error' : 'Notification')}</h4>
        <p className="toast-message">{toast.message}</p>
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
}

export default Toast;
