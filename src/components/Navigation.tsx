import React from "react";
import { 
  BarChart3, 
  Map as MapIcon, 
  Trophy, 
  Calendar, 
  LayoutGrid,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  Compass,
  User as UserIcon,
  CreditCard
} from "lucide-react";
import { View } from "../types";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

interface NavItemProps {
  view: View;
  currentView: View;
  label: string;
  icon: React.ElementType;
  onClick: (view: View) => void;
}

const NavItem = ({ view, currentView, label, icon: Icon, onClick }: NavItemProps) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => onClick(view)}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-all duration-300",
        isActive ? "text-secondary" : "text-on-surface-variant opacity-60 hover:opacity-100"
      )}
    >
      <Icon size={20} className={cn(isActive && "fill-secondary/20")} />
      <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
      {isActive && (
        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-secondary" />
      )}
    </button>
  );
};

export const BottomNav = ({ currentView, setView }: { currentView: View; setView: (v: View) => void }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-white/5 bg-surface-container-high/60 px-1 py-1 backdrop-blur-3xl md:hidden">
      <NavItem view="dashboard" currentView={currentView} label="Stats" icon={BarChart3} onClick={setView} />
      <NavItem view="explorer" currentView={currentView} label="Map" icon={Compass} onClick={setView} />
      <NavItem view="feed" currentView={currentView} label="Feed" icon={LayoutGrid} onClick={setView} />
      <NavItem view="buddy" currentView={currentView} label="Events" icon={Calendar} onClick={setView} />
      <NavItem view="pricing" currentView={currentView} label="Pro" icon={CreditCard} onClick={setView} />
      <NavItem view="profile" currentView={currentView} label="Profile" icon={UserIcon} onClick={setView} />
    </nav>
  );
};

export const DesktopNav = ({ currentView, setView }: { currentView: View; setView: (v: View) => void }) => {
  return (
    <aside className="hidden w-64 flex-col border-r border-white/5 bg-surface-container-high p-6 md:flex">
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-black italic tracking-tighter text-primary">GoDive</h1>
      </div>
      
      <nav className="flex flex-grow flex-col gap-2">
        <DesktopNavItem view="dashboard" currentView={currentView} label="Dashboard" icon={BarChart3} onClick={setView} />
        <DesktopNavItem view="explorer" currentView={currentView} label="Explorer Map" icon={Compass} onClick={setView} />
        <DesktopNavItem view="feed" currentView={currentView} label="Community Feed" icon={LayoutGrid} onClick={setView} />
        <DesktopNavItem view="buddy" currentView={currentView} label="Expeditions & Events" icon={Calendar} onClick={setView} />
        <DesktopNavItem view="pricing" currentView={currentView} label="Membership" icon={CreditCard} onClick={setView} />
        <DesktopNavItem view="profile" currentView={currentView} label="Profile" icon={UserIcon} onClick={setView} />
      </nav>
      
      <div className="mt-auto opacity-40 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => signOut(auth)}
          className="flex w-full items-center gap-3 rounded-xl p-3 text-on-surface-variant hover:bg-error/10 hover:text-error"
        >
          <LogOut size={20} />
          <span className="font-semibold">Log out</span>
        </button>
      </div>
    </aside>
  );
};

const DesktopNavItem = ({ view, currentView, label, icon: Icon, onClick }: NavItemProps) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => onClick(view)}
      className={cn(
        "flex items-center gap-4 rounded-xl p-4 transition-all duration-300",
        isActive 
          ? "bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(76,214,251,0.1)]" 
          : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
      )}
    >
      <Icon size={24} className={cn(isActive ? "text-secondary" : "opacity-70")} />
      <span className="font-bold tracking-tight">{label}</span>
    </button>
  );
};
