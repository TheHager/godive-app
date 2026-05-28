import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { NotificationService, AppNotification } from '../lib/NotificationService';
import { cn } from '../lib/utils';

export const NotificationCenter = ({ onClose, onNavigateToDiveTimer }: { onClose: () => void, onNavigateToDiveTimer?: () => void }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const service = NotificationService.getInstance();

  useEffect(() => {
    const handleUpdate = (notifs: AppNotification[]) => {
      setNotifications(notifs);
    };
    service.addListener(handleUpdate);
    return () => service.removeListener(handleUpdate);
  }, []);

  const handleMarkAsRead = (id: string) => {
    service.markAsRead(id);
  };

  const handleMarkAll = () => {
    service.markAllAsRead();
  };

  const handleClearAll = () => {
    service.clearAll();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'safety': return <AlertTriangle size={20} className="text-red-500" />;
      case 'social': return <CheckCircle2 size={20} className="text-secondary" />;
      default: return <Info size={20} className="text-[#0055ff]" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex justify-end bg-slate-900/20 backdrop-blur-sm "
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md h-[100dvh] border-l border-slate-200/20 flex flex-col shadow-2xl bg-slate-50/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl shadow-sm flex flex-col shrink-0">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <Bell className="text-[#0055ff]" size={24} />
              <h2 className="text-xl font-black uppercase tracking-widest text-[#0b2240]">Notifications</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-100/80 hover:bg-slate-200 transition-colors text-[#475569] cursor-pointer flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between px-6 pb-4">
            <p className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              {notifications.filter(n => !n.read).length} Unread
            </p>
            <div className="flex gap-4">
              <button 
                onClick={handleMarkAll}
                className="text-[10px] font-black uppercase tracking-widest text-[#0055ff] hover:text-blue-700 transition-colors cursor-pointer"
              >
                Mark All Read
              </button>
              <button 
                onClick={handleClearAll}
                className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-5 relative">
          <AnimatePresence>
            {notifications.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-center p-10 bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/50 shadow-sm mx-auto my-auto max-w-[80%]"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                  <Bell size={28} className="text-[#0055ff]" />
                </div>
                <p className="text-base font-black uppercase tracking-widest text-[#0b2240]">No notifications</p>
                <p className="text-sm text-[#475569] mt-2 font-medium">You're all caught up!</p>
              </motion.div>
            ) : (
              notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    handleMarkAsRead(notif.id);
                    if (notif.type === 'safety') {
                      onClose();
                      onNavigateToDiveTimer?.();
                    }
                  }}
                  className={cn(
                    "p-4 rounded-2xl cursor-pointer transition-all border bg-white",
                    notif.read 
                      ? "border-slate-200 opacity-70 shadow-md" 
                      : "border-[#0055ff]/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_40px_-4px_rgba(0,0,0,0.2)]"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "mt-1 p-2 rounded-xl flex-shrink-0",
                      notif.type === 'safety' ? "bg-red-500/10" : "bg-[#0055ff]/10"
                    )}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={cn(
                          "font-bold text-sm truncate pr-2",
                          notif.type === 'safety' ? "text-red-600" : "text-[#0b2240]"
                        )}>
                          {notif.title}
                        </h4>
                        {!notif.read && <div className="w-2 h-2 rounded-full bg-[#0055ff] flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#083344] mt-3">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
