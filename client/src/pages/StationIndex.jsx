import React, { useState, useEffect, useCallback } from "react";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";
import YearMultiSelect from "../components/YearMultiSelect";

function fmtNum(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }
function fmtRate(n) { return n != null ? Number(n).toFixed(2) : "N/A"; }

const BOROUGHS = ["", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

function yearsLabel(years) {
  if (!years.length) return "";
  if (years.length === 1) return `${years[0]}`;
  const sorted = [...years].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const isContiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
  return isContiguous ? `${min}-${max}` : sorted.join(", ");
}

export default function StationIndex() {
  const [busiestData, setBusiestData] = useState([]);
  const [intensityData, setIntensityData] = useState([]);
  const [borough, setBorough] = useState("");
  const [years, setYears] = useState([2024]);
  const [intensityLimit, setIntensityLimit] = useState(50);
  const [loading, setLoading] = useState({ busiest: true, intensity: true });
  const [errors, setErrors] = useState({});

  const fetchBusiest = useCallback(async () => {
    setLoading((l) => ({ ...l, busiest: true }));
    try {
      const params = { limit: 10 };
      if (years.length) params.years = years;
      const res = await api.get("/stations/busiest", { params });
      setBusiestData(res.data);
      setErrors((e) => ({ ...e, busiest: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, busiest: err.message }));
    } finally {
      setLoading((l) => ({ ...l, busiest: false }));
    }
  }, [years]);

  const fetchIntensity = useCallback(async () => {
    setLoading((l) => ({ ...l, intensity: true }));
    try {
      const params = { limit: intensityLimit };
      if (borough) params.borough = borough;
      if (years.length) params.years = years;
      const res = await api.get("/stations/arrest-intensity", { params });
      setIntensityData(res.data);
      setErrors((e) => ({ ...e, intensity: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, intensity: err.message }));
    } finally {
      setLoading((l) => ({ ...l, intensity: false }));
    }
  }, [borough, years, intensityLimit]);

  useEffect(() => {
    fetchBusiest();
    fetchIntensity();
  }, []);

  const totalRidership = busiestData.reduce((s, r) => s + Number(r.total_ridership || 0), 0);
  const topStation = busiestData[0];
  const maxIntensity = intensityData.length
    ? Math.max(...intensityData.map((r) => Number(r.arrests_per_100k_riders || 0)))
    : null;

  const yearsCopy = yearsLabel(years);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Station Safety Index</h1>
        <p>Busiest stations by ridership and arrest intensity per station</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Borough</label>
          <select value={borough} onChange={(e) => setBorough(e.target.value)}>
            {BOROUGHS.map((b) => <option key={b} value={b}>{b || "All Boroughs"}</option>)}
          </select>
        </div>
        <YearMultiSelect value={years} onChange={setYears} />
        <div className="filter-group">
          <label>Limit</label>
          <select value={intensityLimit} onChange={(e) => setIntensityLimit(Number(e.target.value))}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={() => { fetchBusiest(); fetchIntensity(); }}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button
            className="btn btn-ghost"
            onClick={() => { setBorough(""); setYears([2024]); setIntensityLimit(50); }}
          >
            Clear
          </button>
        </div>
      </div>

      {!loading.busiest && (
        <div className="grid-3 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard
            label="Top Station"
            value={topStation?.station_complex || "N/A"}
            subValue={topStation?.borough}
            color="#3b82f6"
          />
          <MetricCard
            label="Top 10 Combined Ridership"
            value={`${(totalRidership / 1_000_000).toFixed(1)}M`}
            subValue={`rides${yearsCopy ? ` (${yearsCopy})` : ""}`}
            color="#10b981"
          />
          <MetricCard
            label="Highest Arrest Intensity"
            value={maxIntensity != null ? fmtRate(maxIntensity) : "N/A"}
            subValue="arrests per 100k riders"
            color="#ef4444"
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        <div className="chart-container" style={{ marginBottom: 0 }}>
          <div className="chart-title">Station Arrest Intensity vs. Ridership</div>
          <div className="chart-subtitle">
            Arrests per 100,000 riders across selected years &mdash; surfaces over- and under-policed stations relative to foot traffic
          </div>

          {loading.intensity && <LoadingSpinner />}
          {errors.intensity && <ErrorMessage message={errors.intensity} onRetry={fetchIntensity} />}
          {!loading.intensity && !errors.intensity && (
            <div className="table-container ui-fade-in" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Station</th>
                    <th>Borough</th>
                    <th>Total Ridership</th>
                    <th>Total Arrests</th>
                    <th>Arrests / 100k Riders</th>
                  </tr>
                </thead>
                <tbody>
                  {intensityData.map((row, i) => (
                    <tr key={`${row.station_complex}-${i}`}>
                      <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{row.station_complex}</td>
                      <td>{row.borough}</td>
                      <td>{fmtNum(row.total_ridership)}</td>
                      <td>{fmtNum(row.total_arrests)}</td>
                      <td>
                        <span className={
                          Number(row.arrests_per_100k_riders) > 50 ? "badge badge-red" :
                          Number(row.arrests_per_100k_riders) > 10 ? "badge badge-yellow" : "badge badge-green"
                        }>
                          {fmtRate(row.arrests_per_100k_riders)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {intensityData.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  No data found for the selected filters.
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">Top 10 Busiest Stations</div>
            <div className="chart-subtitle" style={{ marginBottom: 12 }}>By total ridership{yearsCopy ? ` (${yearsCopy})` : ""}</div>
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
                      <div style={{
                        fontSize: "0.8rem", fontWeight: 500, color: "var(--white)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
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
