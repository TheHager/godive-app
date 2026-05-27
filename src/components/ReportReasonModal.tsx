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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 ">
      <div className="relative w-full max-w-md premium-glass rounded-3xl border  shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
              <AlertTriangle className="text-error" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#0b2240]">Report Content</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full premium-glass hover:premium-glass text-[#475569] hover:text-[#0b2240] transition-colors border "
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#475569] mb-2">
              Reason for reporting
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details about why this content should be removed..."
              className="premium-input w-full h-32 rounded-2xl   -white/10 p-4 text-sm font-medium text-[#0b2240]  focus:-error -1  resize-none placeholder:text-[#083344]"
              required
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl premium-glass text-[#0b2240] font-bold text-sm hover:premium-glass transition-colors"
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
