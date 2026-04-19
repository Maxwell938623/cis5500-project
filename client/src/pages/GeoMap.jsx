import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";

// Fix leaflet icon issue with CRA
import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BOROUGH_COLORS = {
  Manhattan: "#3b82f6",
  Brooklyn: "#f59e0b",
  Queens: "#10b981",
  Bronx: "#ef4444",
  "Staten Island": "#8b5cf6",
};

const BOROUGHS = ["", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

function fmtNum(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }

function getRadius(ridership, max) {
  return Math.max(6, Math.min(28, 6 + (Number(ridership) / max) * 22));
}

export default function GeoMap() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [borough, setBorough] = useState("");
  const [topK, setTopK] = useState("5");

  const fetchStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (topK !== "all") params.top_k = Number(topK);
      if (borough) params.borough = borough;
      const res = await api.get("/map/top-non-cbd-stations", { params });
      setStations(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [borough, topK]);

  useEffect(() => { fetchStations(); }, []);

  const maxRidership = stations.length
    ? Math.max(...stations.map((s) => Number(s.total_ridership)))
    : 1;

  const totalRidership = stations.reduce((s, r) => s + Number(r.total_ridership || 0), 0);
  const boroughCount = [...new Set(stations.map((s) => s.borough))].length;

  const validStations = stations.filter(
    (s) => s.latitude != null && s.longitude != null &&
      !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude))
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Geospatial Station Map</h1>
        <p>Top ridership stations by borough , circle size reflects total ridership</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Borough</label>
          <select value={borough} onChange={(e) => setBorough(e.target.value)}>
            {BOROUGHS.map((b) => <option key={b} value={b}>{b || "All Boroughs"}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Top Stations per Borough</label>
          <select value={topK} onChange={(e) => setTopK(e.target.value)}>
            {["3", "5", "10", "15", "20", "25", "30", "40", "50", "75", "100", "all"].map((n) => (
              <option key={n} value={n}>{n === "all" ? "All" : n}</option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchStations}>Apply</button>
        </div>
      </div>

      {/* Metrics */}
      {!loading && !error && (
        <div className="grid-3 ui-fade-in" style={{ marginBottom: 20 }}>
          <MetricCard label="Stations Shown" value={stations.length} color="#3b82f6" />
          <MetricCard label="Boroughs" value={boroughCount} color="#10b981" />
          <MetricCard
            label="Total Ridership"
            value={(totalRidership / 1_000_000).toFixed(1) + "M"}
            subValue="across shown stations"
            color="#f59e0b"
          />
        </div>
      )}

      {loading && <LoadingSpinner message="Loading station map data..." />}
      {error && <ErrorMessage message={error} onRetry={fetchStations} />}

      {!loading && !error && (
        <div className="ui-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          {/* Map */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            <MapContainer
              center={[40.7128, -74.006]}
              zoom={11}
              style={{ height: 600, width: "100%", background: "#1a2535" }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {validStations.map((station, i) => (
                <CircleMarker
                  key={`${station.station_complex}-${i}`}
                  center={[Number(station.latitude), Number(station.longitude)]}
                  radius={getRadius(station.total_ridership, maxRidership)}
                  pathOptions={{
                    fillColor: BOROUGH_COLORS[station.borough] || "#3b82f6",
                    fillOpacity: 0.8,
                    color: "white",
                    weight: 1.5,
                  }}
                >
                  <Popup className="station-popup">
                    <div style={{
                      background: "var(--navy-light)",
                      color: "var(--text-primary)",
                      borderRadius: 8,
                      padding: "10px 26px 10px 10px",
                      minWidth: 200,
                      fontSize: "0.875rem",
                    }}>
                      <div style={{ fontWeight: 700, color: BOROUGH_COLORS[station.borough] || "white", marginBottom: 6 }}>
                        {station.station_complex}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Borough: </span>
                        {station.borough}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Ridership: </span>
                        <strong>{fmtNum(station.total_ridership)}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#94a3b8" }}>Borough Rank: </span>
                        #{station.borough_rank}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Station list sidebar */}
          <div className="chart-container" style={{ marginBottom: 0, maxHeight: 620, overflowY: "auto" }}>
            <div className="chart-title">Station List</div>
            <div className="chart-subtitle" style={{ marginBottom: 12 }}>Top stations by borough</div>

            {/* Borough legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {Object.entries(BOROUGH_COLORS).map(([b, c]) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                  <span style={{ color: "var(--text-secondary)" }}>{b}</span>
                </div>
              ))}
            </div>

            {stations.map((station, i) => (
              <div
                key={`${station.station_complex}-${i}`}
                style={{
                  padding: "10px 0",
                  borderBottom: i < stations.length - 1 ? "1px solid var(--border)" : "none",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: BOROUGH_COLORS[station.borough] || "#64748b",
                  marginTop: 4,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: "0.8rem", color: "var(--white)" }}>
                    {station.station_complex}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
                    {station.borough} &bull; Rank #{station.borough_rank}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--accent)", marginTop: 2, fontWeight: 500 }}>
                    {(Number(station.total_ridership) / 1_000_000).toFixed(2)}M rides
                  </div>
                </div>
              </div>
            ))}

            {stations.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                No stations found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

