import React from 'react';

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title?: string, message: string, onConfirm: () => void, onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
        {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
        <p className="text-white/80 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl font-medium text-white/70 bg-white/5 hover:bg-white/10 transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl font-medium text-black bg-white hover:bg-gray-200 transition-colors">
            Oke
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal({ isOpen, title, message, onClose }: { isOpen: boolean, title?: string, message: string, onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
        {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
        <p className="text-white/80 mb-6">{message}</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl font-medium text-black bg-white hover:bg-gray-200 transition-colors">
          Tutup
        </button>
      </div>
    </div>
  );
}
