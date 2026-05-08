import { createContext, useContext, useState, ReactNode } from 'react';

interface UserContextType {
  pinnedBadgeId: string | null;
  setPinnedBadgeId: (id: string | null) => void;
  badgeStats: Record<string, number>;
  updateBadgeStats: (stats: Partial<Record<string, number>>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // Use localStorage or initial state
  const [pinnedBadgeId, setPinnedBadgeIdState] = useState<string | null>(() => {
    return localStorage.getItem('pinnedBadgeId') || null;
  });

  const [badgeStats, setBadgeStats] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('badgeStats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    // Initial empty stats
    return {
      recreational: 0,
      deep: 0,
      wreck: 0,
      night: 0,
      cave: 0,
      photography: 0,
      navigation: 0,
      rescue: 0,
      training: 0
    };
  });

  const setPinnedBadgeId = (id: string | null) => {
    if (id) {
      localStorage.setItem('pinnedBadgeId', id);
    } else {
      localStorage.removeItem('pinnedBadgeId');
    }
    setPinnedBadgeIdState(id);
  };

  const updateBadgeStats = (newStats: Partial<Record<string, number>>) => {
    setBadgeStats(prev => {
      const updated = { ...prev };
      Object.entries(newStats).forEach(([key, val]) => {
        updated[key] = (updated[key] || 0) + (val || 0);
      });
      localStorage.setItem('badgeStats', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <UserContext.Provider value={{ pinnedBadgeId, setPinnedBadgeId, badgeStats, updateBadgeStats }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
