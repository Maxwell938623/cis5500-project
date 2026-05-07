import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import BoroughEquity from "./pages/BoroughEquity";
import FinancialImpact from "./pages/FinancialImpact";
import StationIndex from "./pages/StationIndex";
import GeoMap from "./pages/GeoMap";
import HistoricalTrends from "./pages/HistoricalTrends";
import AuthPage from "./pages/AuthPage";
import { supabase } from "./supabaseClient";

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function AnimatedRoutes({ session }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("route-fade-in");

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage("route-fade-out");
    }
  }, [location, displayLocation]);

  function handleAnimationEnd() {
    if (transitionStage === "route-fade-out") {
      setDisplayLocation(location);
      setTransitionStage("route-fade-in");
    }
  }

  return (
    <div className={`route-transition-shell ${transitionStage}`} onAnimationEnd={handleAnimationEnd}>
      <Routes location={displayLocation}>
        <Route path="/" element={<Navigate to={session ? "/trends" : "/auth"} replace />} />
        <Route path="/auth" element={<AuthPage session={session} />} />
        <Route
          path="/trends"
          element={
            <ProtectedRoute session={session}>
              <HistoricalTrends />
            </ProtectedRoute>
          }
        />
        <Route
          path="/borough-equity"
          element={
            <ProtectedRoute session={session}>
              <BoroughEquity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financial-impact"
          element={
            <ProtectedRoute session={session}>
              <FinancialImpact />
            </ProtectedRoute>
          }
        />
        <Route
          path="/station-index"
          element={
            <ProtectedRoute session={session}>
              <StationIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute session={session}>
              <GeoMap />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (!supabase) {
        if (isMounted) setAuthLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    };

    loadSession();

    if (!supabase) return () => { isMounted = false; };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card ui-fade-in" style={{ width: "min(92vw, 420px)", textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>Loading session</h2>
          <p style={{ color: "var(--text-secondary)" }}>Checking your sign-in status...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {session && <Navbar onSignOut={handleSignOut} email={session.user?.email} />}
        <main style={{ flex: 1 }}>
          <AnimatedRoutes session={session} />
        </main>
        {session && (
          <footer style={{
            textAlign: "center",
            padding: "16px",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            borderTop: "1px solid var(--border)",
            background: "var(--navy-light)"
          }}>
            NYC Subway Analytics, CIS 5500 Project, Data: MTA Open Data
          </footer>
        )}
      </div>
    </Router>
  );
}

export default App;
