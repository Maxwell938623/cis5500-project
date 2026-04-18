import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import BoroughEquity from "./pages/BoroughEquity";
import FinancialImpact from "./pages/FinancialImpact";
import StationIndex from "./pages/StationIndex";
import GeoMap from "./pages/GeoMap";
import HistoricalTrends from "./pages/HistoricalTrends";

function App() {
  return (
    <Router>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/trends" replace />} />
            <Route path="/trends" element={<HistoricalTrends />} />
            <Route path="/borough-equity" element={<BoroughEquity />} />
            <Route path="/financial-impact" element={<FinancialImpact />} />
            <Route path="/station-index" element={<StationIndex />} />
            <Route path="/map" element={<GeoMap />} />
          </Routes>
        </main>
        <footer style={{
          textAlign: "center",
          padding: "16px",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
          borderTop: "1px solid var(--border)",
          background: "var(--navy-light)"
        }}>
          NYC Subway Analytics &mdash; CIS 5500 Project &mdash; Data: MTA Open Data
        </footer>
      </div>
    </Router>
  );
}

export default App;
