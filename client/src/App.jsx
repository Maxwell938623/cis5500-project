import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import BoroughEquity from "./pages/BoroughEquity";
import FinancialImpact from "./pages/FinancialImpact";
import StationIndex from "./pages/StationIndex";
import GeoMap from "./pages/GeoMap";
import HistoricalTrends from "./pages/HistoricalTrends";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";

function OAuthHandler() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);
    const token = hashParams.get("token") || params.get("token");
    const error = params.get("error");
    if (token) {
      loginWithToken(token)
        .then(() => navigate("/trends", { replace: true }))
        .catch(() => navigate("/login?error=token_invalid", { replace: true }));
    } else if (error) {
      navigate(`/login?error=${error}`, { replace: true });
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) return null;
  return <Navigate to="/trends" replace />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AnimatedRoutes() {
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
        <Route path="/" element={<OAuthHandler />} />
        <Route path="/oauth-callback" element={<OAuthHandler />} />
        <Route path="/login" element={<Login />} />
        <Route path="/trends" element={<ProtectedRoute><HistoricalTrends /></ProtectedRoute>} />
        <Route path="/borough-equity" element={<ProtectedRoute><BoroughEquity /></ProtectedRoute>} />
        <Route path="/financial-impact" element={<ProtectedRoute><FinancialImpact /></ProtectedRoute>} />
        <Route path="/station-index" element={<ProtectedRoute><StationIndex /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><GeoMap /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {user && !isLoginPage && <Navbar />}
      <main style={{ flex: 1 }}>
        <AnimatedRoutes />
      </main>
      {user && !isLoginPage && (
        <footer style={{
          textAlign: "center",
          padding: "16px",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
          borderTop: "1px solid var(--border)",
          background: "var(--navy-light)",
        }}>
          NYC Subway Analytics, CIS 5500 Project, Data: MTA Open Data
        </footer>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  );
}

export default App;
