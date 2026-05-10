import { useState, useEffect } from "react";
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
import { FriendsView } from "./components/FriendsView";
import { AdminView } from "./components/AdminView";
import { EquipmentView } from "./components/EquipmentView";
import { View } from "./types";
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    window.history.replaceState({ view: "dashboard" }, "");
    const onPopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        setView("dashboard");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleSetView = (newView: View) => {
    if (newView !== "buddy") {
      setSelectedEventId(null);
    }
    setView(newView);
    window.history.pushState({ view: newView }, "");
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
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
      case "dashboard": return <DashboardView onNavigateToEvent={(id: string) => { setSelectedEventId(id); setView("buddy"); }} onNavigateToProfile={() => setView("profile")} />;
      case "explorer": return <ExplorerView onNavigateToEvent={(id: string) => { setSelectedEventId(id); setView("buddy"); }} />;
      case "feed": return <FeedView setView={handleSetView} onNavigateToEvent={(id: string) => { setSelectedEventId(id); setView("buddy"); }} />;
      case "buddy": return <BuddyView setView={handleSetView} initialEventId={selectedEventId} />;
      case "friends": return <FriendsView setView={handleSetView} />;
      case "pricing": return <PricingView />;
      case "profile": return <ProfileView setView={handleSetView} />;
      case "admin": return <AdminView setView={handleSetView} />;
      case "equipment": return <EquipmentView setView={handleSetView} />;
      default: return <DashboardView onNavigateToEvent={(id: string) => { setSelectedEventId(id); setView("buddy"); }} onNavigateToProfile={() => setView("profile")} />;
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
