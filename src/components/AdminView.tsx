import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShieldAlert, Search, RefreshCw, UserCheck, ArrowLeft } from "lucide-react";
import { UserProfile, View } from "../types";
import { cn } from "../lib/utils";

export const AdminView = ({ setView }: { setView?: (v: View) => void }) => {
  const { user } = useAuth();
  const [emailSearch, setEmailSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  if (user?.email?.toLowerCase() !== "tobias.h.jensen@gmail.com") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-on-surface p-6 text-center">
        <ShieldAlert size={64} className="text-error mb-4" />
        <h1 className="text-3xl font-black uppercase tracking-widest">Access Denied</h1>
        <p className="mt-2 text-on-surface-variant font-medium">You do not have permission to view this page.</p>
      </div>
    );
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSearch.trim()) return;

    setIsSearching(true);
    setMessage(null);
    setFoundUser(null);

    try {
      const q = query(collection(db, "users"), where("email", "==", emailSearch.trim().toLowerCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setMessage({ type: 'error', text: "No user found with that email address." });
      } else {
        const userData = snap.docs[0].data() as UserProfile;
        setFoundUser(userData);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "An error occurred while searching." });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateTier = async (tier: "free" | "premium" | "vip") => {
    if (!foundUser) return;
    setIsUpdating(true);
    setMessage(null);

    try {
      const userRef = doc(db, "users", foundUser.id);
      await updateDoc(userRef, {
        subscriptionTier: tier
      });
      setFoundUser(prev => prev ? { ...prev, subscriptionTier: tier } as UserProfile : null);
      setMessage({ type: 'success', text: `Successfully updated ${foundUser.email} to ${tier.toUpperCase()} tier.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to update user's subscription tier. Check permissions." });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 relative">
      {setView && (
        <button 
          onClick={() => setView('profile')}
          className="absolute left-6 top-6 flex items-center justify-center p-3 rounded-2xl bg-surface-container-high/50 hover:bg-white/10 transition-colors z-10"
        >
          <ArrowLeft size={20} className="text-on-surface" />
        </button>
      )}

      <div className="mb-10 text-center mt-4">
        <h2 className="text-4xl font-black italic tracking-tighter text-on-surface">Admin <span className="text-secondary">Dashboard</span></h2>
        <p className="font-bold text-xs uppercase tracking-widest text-on-surface-variant/60 mt-2">Manage User Subscriptions</p>
      </div>

      <div className="rounded-[40px] bg-surface-container-high/20 border border-white/5 p-8 shadow-xl">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary" size={20} />
            <input 
              type="text" 
              placeholder="Search user by email address..."
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              className="w-full rounded-2xl bg-surface-container-high border border-white/10 px-6 py-4 pl-14 text-sm font-bold text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 placeholder:text-on-surface-variant/40"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching || !emailSearch.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-8 py-4 text-xs font-black uppercase tracking-widest text-on-secondary hover:bg-secondary-container disabled:opacity-50 transition-all font-bold"
          >
            {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <span>Find User</span>}
          </button>
        </form>

        {message && (
          <div className={cn("mb-8 p-4 rounded-2xl border text-sm font-bold text-center", message.type === 'error' ? "bg-error/10 border-error/20 text-error" : "bg-primary/10 border-primary/20 text-primary")}>
            {message.text}
          </div>
        )}

        {foundUser && (
          <div className="rounded-3xl bg-surface-container/50 border border-white/10 p-6 flex flex-col md:flex-row items-center gap-8">
            <div className="flex items-center gap-4 flex-1">
              {foundUser.photoURL ? (
                <img src={foundUser.photoURL} alt="" className="w-16 h-16 rounded-2xl border-2 border-white/10 object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant">
                  <UserCheck size={32} />
                </div>
              )}
              <div>
                <h3 className="text-xl font-black text-on-surface">{foundUser.displayName || 'Unnamed User'}</h3>
                <p className="text-sm font-medium text-on-surface-variant">{foundUser.email}</p>
                <div className="mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg border border-white/10 inline-block text-secondary">
                  Current Tier: {foundUser.subscriptionTier || 'Free'}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              {(["free", "premium", "vip"] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => handleUpdateTier(tier)}
                  disabled={isUpdating || foundUser.subscriptionTier === tier || (!foundUser.subscriptionTier && tier === 'free')}
                  className="rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white/10 hover:border-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set to {tier}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
