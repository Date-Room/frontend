import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyThemePreference, detachThemePreferenceListener } from "@/lib/theme";

// Pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import CreateRoom from "./pages/CreateRoom";
import PreRoom from "./pages/PreRoom";
import JoinByCode from "./pages/JoinByCode";
import Lobby from "./pages/Lobby";
import LiveRoom from "./pages/LiveRoom";
import Recap from "./pages/Recap";
import OurRoom from "./pages/OurRoom";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import NeedInvite from "./pages/NeedInvite";
import { AuthGuard } from "./components/AuthGuard";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Per-user theme preference used to ride on Supabase's user_metadata.
    // Backend auth has no equivalent yet (Phase 1 is "fresh start"), so we
    // apply the default and revisit once a /v1/users/me preference field
    // exists.
    applyThemePreference(undefined);
    return () => {
      detachThemePreferenceListener();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public / Marketing */}
            <Route path="/" element={<AuthGuard requireAuth={false}><Landing /></AuthGuard>} />
            <Route path="/auth" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* Room Entry / Gating */}
            <Route path="/invite" element={<AuthGuard requireAuth={false}><NeedInvite /></AuthGuard>} />
            <Route path="/entry-denied" element={<NeedInvite />} />
            <Route path="/join" element={<JoinByCode />} />
            <Route path="/i/:id" element={<Lobby />} />
            <Route path="/i/:id/:pin" element={<Lobby />} />

            {/* Authenticated Dashboard */}
            <Route path="/home" element={<AuthGuard><Home /></AuthGuard>} />
            <Route path="/create" element={<AuthGuard><CreateRoom /></AuthGuard>} />
            <Route path="/rooms/:id/pre" element={<AuthGuard><PreRoom /></AuthGuard>} />
            <Route path="/room/:id" element={<AuthGuard><LiveRoom /></AuthGuard>} />
            <Route path="/room/:id/recap" element={<AuthGuard><Recap /></AuthGuard>} />
            <Route path="/our-room/:id" element={<AuthGuard><OurRoom /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
