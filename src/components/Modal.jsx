import React from 'react';
import { Button } from './UI';

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface radius-card w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-medium text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", isDanger = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface radius-card w-full max-w-sm shadow-xl p-6 text-center">
        <h3 className="text-xl font-medium text-ink mb-3">{title}</h3>
        <p className="text-ink-soft mb-8">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose} className="flex-1">{cancelText}</Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }} className="flex-1">{confirmText}</Button>
        </div>
      </div>
    </div>
  );
};
