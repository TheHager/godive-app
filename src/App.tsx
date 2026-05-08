import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UserProvider } from "./contexts/UserContext";
import { LoginView } from "./components/LoginView";
import { Layout } from "./components/Layout";
import { DashboardView } from "./components/DashboardView";
import { ExplorerView } from "./components/ExplorerView";
import { FeedView } from "./components/FeedView";
import { BuddyView } from "./components/BuddyView";
import { PricingView } from "./components/PricingView";
import { ProfileView } from "./components/ProfileView";
import { View } from "./types";
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const handleSetView = (newView: View) => {
    if (newView !== "buddy") {
      setSelectedEventId(null);
    }
    setView(newView);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-transparent shadow-[0_0_20px_rgba(76,214,251,0.2)]" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary animate-pulse">Navigating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "explorer": return <ExplorerView />;
      case "feed": return <FeedView setView={handleSetView} onNavigateToEvent={(id: string) => { setSelectedEventId(id); setView("buddy"); }} />;
      case "buddy": return <BuddyView setView={handleSetView} initialEventId={selectedEventId} />;
      case "pricing": return <PricingView />;
      case "profile": return <ProfileView />;
      default: return <DashboardView />;
    }
  };

  return (
    <Layout currentView={view} setView={handleSetView}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <APIProvider apiKey={API_KEY}>
      <AuthProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </AuthProvider>
    </APIProvider>
  );
}
