import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";

function fmtNum(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : "N/A"; }

const BOROUGHS = ["", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

export default function StationIndex() {
  const [riskData, setRiskData] = useState([]);
  const [busiestData, setBusiestData] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [stationDetail, setStationDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [borough, setBorough] = useState("");
  const [line, setLine] = useState("");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState({ risk: true, busiest: true, detail: false });
  const [errors, setErrors] = useState({});
  const searchRef = useRef(null);

  const fetchRisk = useCallback(async () => {
    setLoading((l) => ({ ...l, risk: true }));
    try {
      const params = { limit };
      if (borough) params.borough = borough;
      if (line) params.line = line;
      if (searchQuery && !selectedStation) params.station_name = searchQuery;
      const res = await api.get("/stations/risk-profile", { params });
      setRiskData(res.data);
      setErrors((e) => ({ ...e, risk: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, risk: err.message }));
    } finally {
      setLoading((l) => ({ ...l, risk: false }));
    }
  }, [borough, line, limit, searchQuery, selectedStation]);

  const fetchBusiest = useCallback(async () => {
    setLoading((l) => ({ ...l, busiest: true }));
    try {
      const params = { limit: 10 };
      if (borough) params.borough = borough;
      const res = await api.get("/stations/busiest", { params });
      setBusiestData(res.data);
      setErrors((e) => ({ ...e, busiest: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, busiest: err.message }));
    } finally {
      setLoading((l) => ({ ...l, busiest: false }));
    }
  }, [borough]);

  const fetchDetail = useCallback(async (stationId) => {
    if (!stationId) return;
    setLoading((l) => ({ ...l, detail: true }));
    try {
      const res = await api.get(`/stations/${stationId}`);
      setStationDetail(res.data);
      setErrors((e) => ({ ...e, detail: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, detail: err.message }));
    } finally {
      setLoading((l) => ({ ...l, detail: false }));
    }
  }, []);

  useEffect(() => { fetchRisk(); fetchBusiest(); }, []);

  // Autocomplete search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/stations/search", { params: { q: searchQuery } });
        setSearchResults(res.data);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelectStation(station) {
    setSelectedStation(station);
    setSearchQuery(station.station_complex);
    setShowDropdown(false);
    fetchDetail(station.station_complex_id);
  }

  function clearStation() {
    setSelectedStation(null);
    setStationDetail(null);
    setSearchQuery("");
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Station Fare-Risk Index</h1>
        <p>Reduced-fare ridership profile by station, a proxy for fare-risk concentration</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {/* Autocomplete search */}
        <div className="filter-group" style={{ position: "relative", minWidth: 260 }} ref={searchRef}>
          <label>Station Search</label>
          <input
            type="text"
            placeholder="Search station name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) clearStation(); }}
            style={{ width: "100%" }}
          />
          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--navy-light)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              zIndex: 100,
              maxHeight: 240,
              overflowY: "auto",
            }}>
              {searchResults.map((s) => (
                <div
                  key={s.station_complex_id}
                  onClick={() => handleSelectStation(s)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "0.875rem",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-light)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ color: "var(--white)", fontWeight: 500 }}>{s.station_complex}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{s.borough}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="filter-group">
          <label>Borough</label>
          <select value={borough} onChange={(e) => setBorough(e.target.value)}>
            {BOROUGHS.map((b) => <option key={b} value={b}>{b || "All Boroughs"}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Line</label>
          <input type="text" placeholder="e.g. A, 4, N" value={line} onChange={(e) => setLine(e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="filter-group">
          <label>Limit</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={() => { fetchRisk(); fetchBusiest(); }}>Apply</button>
        </div>
        {selectedStation && (
          <div className="filter-group" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <button className="btn btn-ghost" onClick={clearStation}>Clear Selection</button>
          </div>
        )}
      </div>

      {/* Station detail card */}
      {selectedStation && (
        <div className="card" style={{ marginBottom: 24, borderColor: "var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: "1.2rem" }}>{selectedStation.station_complex}</h2>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{selectedStation.borough}</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={clearStation}>
              Close
            </button>
          </div>
          {loading.detail && <LoadingSpinner message="Loading station details..." />}
          {errors.detail && <ErrorMessage message={errors.detail} />}
          {!loading.detail && stationDetail && (
            <div className="grid-4 ui-fade-in">
              <MetricCard label="Total Ridership" value={fmtNum(stationDetail.total_ridership)} color="#3b82f6" />
              <MetricCard label="Reduced Fare %" value={fmtPct(stationDetail.reduced_fare_pct)} color="#f59e0b" />
              <MetricCard label="Borough" value={stationDetail.borough || "N/A"} />
              <MetricCard label="Lines" value={stationDetail.daytime_routes || "N/A"} />
              <MetricCard
                label="ADA Accessible"
                value={stationDetail.ada ? "Yes" : "No"}
                color={stationDetail.ada ? "#10b981" : "#ef4444"}
              />
              <MetricCard
                label="CBD Station"
                value={stationDetail.cbd ? "Yes" : "No"}
                color={stationDetail.cbd ? "#3b82f6" : undefined}
              />
              <MetricCard label="Structure" value={stationDetail.structure || "N/A"} />
              <MetricCard
                label="Coordinates"
                value={stationDetail.latitude ? `${Number(stationDetail.latitude).toFixed(4)}, ${Number(stationDetail.longitude).toFixed(4)}` : "N/A"}
                subValue="lat, lng"
              />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* Risk profile table */}
        <div className="chart-container" style={{ marginBottom: 0 }}>
          <div className="chart-title">Fare-Risk Profile by Station</div>
          <div className="chart-subtitle">
            Ranked by reduced-fare ridership percentage within borough, higher % may indicate concentrated need for targeted support
          </div>
          {loading.risk && <LoadingSpinner />}
          {errors.risk && <ErrorMessage message={errors.risk} onRetry={fetchRisk} />}
          {!loading.risk && !errors.risk && (
            <div className="table-container ui-fade-in" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Station</th>
                    <th>Borough</th>
                    <th>Total Ridership</th>
                    <th>Reduced Fare %</th>
                    <th>Borough Rank</th>
                    <th>Lines</th>
                    <th>ADA</th>
                    <th>CBD</th>
                  </tr>
                </thead>
                <tbody>
                  {riskData.map((row, i) => (
                    <tr
                      key={`${row.station_complex}-${i}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSearchQuery(row.station_complex);
                        // Find matching search result
                        api.get("/stations/search", { params: { q: row.station_complex } }).then((res) => {
                          const match = res.data.find((s) => s.station_complex === row.station_complex);
                          if (match) handleSelectStation(match);
                        }).catch(() => {});
                      }}
                    >
                      <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{row.station_complex}</td>
                      <td>{row.borough}</td>
                      <td>{fmtNum(row.total_ridership)}</td>
                      <td>
                        <span className={
                          Number(row.reduced_fare_pct) > 30 ? "badge badge-red" :
                          Number(row.reduced_fare_pct) > 15 ? "badge badge-yellow" : "badge badge-green"
                        }>
                          {fmtPct(row.reduced_fare_pct)}
                        </span>
                      </td>
                      <td>#{row.borough_rank}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{row.daytime_routes}</td>
                      <td>
                        {row.ada ? (
                          <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>ADA</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>,</span>
                        )}
                      </td>
                      <td>
                        {row.cbd ? (
                          <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>CBD</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>,</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {riskData.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  No stations found for the selected filters.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Busiest stations sidebar */}
        <div>
          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">Top 10 Busiest Stations</div>
            <div className="chart-subtitle" style={{ marginBottom: 12 }}>By total ridership</div>
            {loading.busiest && <LoadingSpinner />}
            {errors.busiest && <ErrorMessage message={errors.busiest} />}
            {!loading.busiest && !errors.busiest && (
              <div className="ui-fade-in">
                {busiestData.map((station, i) => (
                  <div
                    key={station.station_complex}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: i < busiestData.length - 1 ? "1px solid var(--border)" : "none",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSearchQuery(station.station_complex);
                      api.get("/stations/search", { params: { q: station.station_complex } }).then((res) => {
                        const match = res.data.find((s) => s.station_complex === station.station_complex);
                        if (match) handleSelectStation(match);
                      }).catch(() => {});
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: "var(--accent-light)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {station.station_complex}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                        {station.borough} &bull; {(Number(station.total_ridership) / 1_000_000).toFixed(1)}M rides
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
