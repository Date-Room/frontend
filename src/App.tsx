import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyThemePreference, detachThemePreferenceListener } from "@/lib/theme";

// Pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Lobby from "./pages/Lobby";
import NeedInvite from "./pages/NeedInvite";
import { RoomErrorBoundary } from "@/components/RoomErrorBoundary";
import { PageShell } from "@/components/PageShell";

// Everything past the front door loads on demand. The entry used to be one
// 1.9 MB script: the live room (and livekit-client, a quarter of it), every
// game, and the admin console all shipped to someone opening an invite link
// on mobile data. The front door itself (landing, auth, invite lobby) stays
// eager so those pages paint without a second round trip.
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Home = lazy(() => import("./pages/Home"));
const CreateRoom = lazy(() => import("./pages/CreateRoom"));
const PreRoom = lazy(() => import("./pages/PreRoom"));
const JoinByCode = lazy(() => import("./pages/JoinByCode"));
const LiveRoom = lazy(() => import("./pages/LiveRoom"));
const Recap = lazy(() => import("./pages/Recap"));
const OurRoom = lazy(() => import("./pages/OurRoom"));
const Settings = lazy(() => import("./pages/Settings"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ChildSafety = lazy(() => import("./pages/ChildSafety"));
const Terms = lazy(() => import("./pages/Terms"));
const Support = lazy(() => import("./pages/Support"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Paywall = lazy(() => import("./pages/Paywall"));
const ProfileComplete = lazy(() => import("./pages/ProfileComplete"));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminPromoCodes = lazy(() => import("./pages/admin/AdminPromoCodes"));
const AdminRooms = lazy(() => import("./pages/admin/AdminRooms"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminChaperon = lazy(() => import("./pages/admin/AdminChaperon"));
const AdminBeta = lazy(() => import("./pages/admin/AdminBeta"));
const AdminLayout = lazy(() =>
  import("./components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
import { AuthGuard } from "./components/AuthGuard";
import { AdminGuard } from "./components/admin/AdminGuard";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

/** Shown for the moment a route's chunk is in flight. Same quiet mark the
 *  room uses while it connects, so a chunk load reads as part of the app,
 *  not a blank page. */
function RouteLoading() {
  return (
    <PageShell className="flex items-center justify-center">
      <div className="relative z-10 animate-fade-in">
        <div className="mx-auto h-2 w-2 rounded-full bg-rosegold animate-pulse-glow" />
      </div>
    </PageShell>
  );
}

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
          <ScrollToTop />
          <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public / Marketing */}
            <Route path="/" element={<AuthGuard requireAuth={false}><Landing /></AuthGuard>} />
            <Route path="/auth" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Published child-safety (CSAE) standards. Required by Google
                Play for Social/Dating apps and referenced in the Play Console
                "Child safety standards" declaration, plus linked in-app from
                Settings → Report a Safety Concern, so the path must stay stable. */}
            <Route path="/child-safety" element={<ChildSafety />} />
            {/* Public account-deletion instructions. Google Play requires a
                URL for this (Data safety), and it's linked from the store
                listing, so the path must stay stable. */}
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/support" element={<Support />} />

            {/* Room Entry / Gating */}
            <Route path="/invite" element={<AuthGuard requireAuth={false}><NeedInvite /></AuthGuard>} />
            <Route path="/entry-denied" element={<NeedInvite />} />
            <Route path="/join" element={<JoinByCode />} />
            <Route path="/i/:id" element={<Lobby />} />
            <Route path="/i/:id/:pin" element={<Lobby />} />
            <Route path="/r/:code" element={<AuthGuard requireAuth={false}><ReferralLanding /></AuthGuard>} />

            {/* Authenticated Dashboard */}
            <Route path="/home" element={<AuthGuard><Home /></AuthGuard>} />
            <Route path="/create" element={<AuthGuard><CreateRoom /></AuthGuard>} />
            <Route path="/rooms/:id/pre" element={<AuthGuard><PreRoom /></AuthGuard>} />
            <Route path="/room/:id" element={<AuthGuard guestParam="participant_id"><RoomErrorBoundary><LiveRoom /></RoomErrorBoundary></AuthGuard>} />
            <Route path="/room/:id/recap" element={<AuthGuard><Recap /></AuthGuard>} />
            <Route path="/our-room/:id" element={<AuthGuard><OurRoom /></AuthGuard>} />
            <Route path="/paywall" element={<AuthGuard><Paywall /></AuthGuard>} />
            <Route path="/profile/complete" element={<AuthGuard><ProfileComplete /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />

            {/* Platform admin */}
            <Route
              path="/admin"
              element={
                <AuthGuard>
                  <AdminGuard>
                    <AdminLayout />
                  </AdminGuard>
                </AuthGuard>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="promo" element={<AdminPromoCodes />} />
              <Route path="rooms" element={<AdminRooms />} />
              <Route path="chaperon" element={<AdminChaperon />} />
              <Route path="beta" element={<AdminBeta />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
