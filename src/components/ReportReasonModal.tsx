import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ReportReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export const ReportReasonModal = ({ isOpen, onClose, onSubmit }: ReportReasonModalProps) => {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onSubmit(reason.trim());
      setReason("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-surface-container-high rounded-3xl border border-white/10 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
              <AlertTriangle className="text-error" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-on-surface">Report Content</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors border border-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">
              Reason for reporting
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details about why this content should be removed..."
              className="w-full h-32 rounded-2xl bg-surface-container border border-white/10 p-4 text-sm font-medium text-on-surface outline-none focus:border-error focus:ring-1 focus:ring-error/50 resize-none placeholder:text-on-surface-variant/40"
              required
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-white/5 text-on-surface font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-6 py-3 rounded-xl bg-error text-error-content font-bold text-sm hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
