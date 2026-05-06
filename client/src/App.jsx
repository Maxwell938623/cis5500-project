import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import BoroughEquity from "./pages/BoroughEquity";
import FinancialImpact from "./pages/FinancialImpact";
import StationIndex from "./pages/StationIndex";
import GeoMap from "./pages/GeoMap";
import HistoricalTrends from "./pages/HistoricalTrends";

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
        <Route path="/" element={<Navigate to="/trends" replace />} />
        <Route path="/trends" element={<HistoricalTrends />} />
        <Route path="/borough-equity" element={<BoroughEquity />} />
        <Route path="/financial-impact" element={<FinancialImpact />} />
        <Route path="/station-index" element={<StationIndex />} />
        <Route path="/map" element={<GeoMap />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <AnimatedRoutes />
        </main>
        <footer style={{
          textAlign: "center",
          padding: "16px",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
          borderTop: "1px solid var(--border)",
          background: "var(--navy-light)"
        }}>
          MetroGuard, CIS 5500 Project, Data: MTA Open Data
        </footer>
      </div>
    </Router>
  );
}

export default App;
