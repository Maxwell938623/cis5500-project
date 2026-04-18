import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";

const BOROUGH_COLORS = {
  Manhattan: "#3b82f6",
  Brooklyn: "#f59e0b",
  Queens: "#10b981",
  Bronx: "#ef4444",
  "Staten Island": "#8b5cf6",
};

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

function fmt(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : "N/A"; }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginTop: 2 }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function BoroughEquity() {
  const [ridershipData, setRidershipData] = useState([]);
  const [adaData, setAdaData] = useState([]);
  const [intensityData, setIntensityData] = useState([]);
  const [loading, setLoading] = useState({ ridership: true, ada: true, intensity: true });
  const [errors, setErrors] = useState({});
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [selectedBoroughs, setSelectedBoroughs] = useState([]);

  const fetchAll = useCallback(async () => {
    const params = {};
    if (yearStart) params.year_start = yearStart;
    if (yearEnd) params.year_end = yearEnd;

    // Ridership by year
    setLoading((l) => ({ ...l, ridership: true }));
    try {
      const res = await api.get("/boroughs/ridership-by-year", { params });
      setRidershipData(res.data);
      setErrors((e) => ({ ...e, ridership: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, ridership: err.message }));
    } finally {
      setLoading((l) => ({ ...l, ridership: false }));
    }

    // ADA stations
    setLoading((l) => ({ ...l, ada: true }));
    try {
      const res = await api.get("/boroughs/ada-stations");
      setAdaData(res.data);
      setErrors((e) => ({ ...e, ada: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, ada: err.message }));
    } finally {
      setLoading((l) => ({ ...l, ada: false }));
    }

    // Evasion intensity
    setLoading((l) => ({ ...l, intensity: true }));
    try {
      const res = await api.get("/boroughs/evasion-intensity", { params });
      setIntensityData(res.data);
      setErrors((e) => ({ ...e, intensity: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, intensity: err.message }));
    } finally {
      setLoading((l) => ({ ...l, intensity: false }));
    }
  }, [yearStart, yearEnd]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Pivot ridership data for grouped bar chart: [{year, Manhattan, Brooklyn, ...}]
  const ridershipPivoted = React.useMemo(() => {
    const map = {};
    const filtered = selectedBoroughs.length
      ? ridershipData.filter((r) => selectedBoroughs.includes(r.borough))
      : ridershipData;
    for (const row of filtered) {
      if (!map[row.year]) map[row.year] = { year: row.year };
      map[row.year][row.borough] = Number(row.total_ridership);
    }
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [ridershipData, selectedBoroughs]);

  const activeBoroughs = selectedBoroughs.length ? selectedBoroughs : BOROUGHS;

  // Borough summary for metric cards
  const boroughSummary = React.useMemo(() => {
    const map = {};
    for (const row of ridershipData) {
      if (!map[row.borough]) map[row.borough] = 0;
      map[row.borough] += Number(row.total_ridership);
    }
    return map;
  }, [ridershipData]);

  // Latest year intensity
  const latestIntensity = React.useMemo(() => {
    const years = [...new Set(intensityData.map((r) => r.year))].sort((a, b) => b - a);
    const latestYear = years[0];
    return intensityData.filter((r) => r.year === latestYear);
  }, [intensityData]);

  const intensityChartData = React.useMemo(() => {
    const map = {};
    for (const row of intensityData) {
      if (!map[row.borough]) map[row.borough] = { borough: row.borough, total: 0, count: 0 };
      map[row.borough].total += Number(row.est_evaded_per_100k_riders);
      map[row.borough].count += 1;
    }
    return Object.values(map).map((v) => ({
      borough: v.borough,
      avg_intensity: +(v.total / v.count).toFixed(2),
    }));
  }, [intensityData]);

  function toggleBorough(borough) {
    setSelectedBoroughs((prev) =>
      prev.includes(borough) ? prev.filter((b) => b !== borough) : [...prev, borough]
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Borough-Level Equity Comparison</h1>
        <p>Ridership patterns, accessibility, and estimated evasion intensity across NYC boroughs</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Year Start</label>
          <input
            type="number" placeholder="e.g. 2020"
            value={yearStart} onChange={(e) => setYearStart(e.target.value)} min="2015" max="2030"
          />
        </div>
        <div className="filter-group">
          <label>Year End</label>
          <input
            type="number" placeholder="e.g. 2024"
            value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} min="2015" max="2030"
          />
        </div>
        <div className="filter-group">
          <label>Boroughs (multi-select)</label>
          <div className="multi-select-shell">
            <div className="multi-select-header">
              {selectedBoroughs.length ? `${selectedBoroughs.length} selected` : "All boroughs"}
            </div>
            <div className="multi-select-chips">
              {BOROUGHS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`multi-select-chip ${selectedBoroughs.includes(b) ? "is-selected" : ""}`}
                  onClick={() => toggleBorough(b)}
                >
                  {b}
                </button>
              ))}
            </div>
            <div className="multi-select-actions">
              <button
                type="button"
                className="multi-select-link"
                onClick={() => setSelectedBoroughs(BOROUGHS)}
              >
                Select All
              </button>
              <button
                type="button"
                className="multi-select-link"
                onClick={() => setSelectedBoroughs([])}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchAll}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => { setYearStart(""); setYearEnd(""); setSelectedBoroughs([]); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Borough metric cards */}
      {!loading.ridership && (
        <div className="grid-5 ui-fade-in" style={{ marginBottom: 24 }}>
          {BOROUGHS.map((b) => (
            <MetricCard
              key={b}
              label={b}
              value={boroughSummary[b] ? (boroughSummary[b] / 1_000_000).toFixed(1) + "M" : "N/A"}
              subValue="total rides"
              color={BOROUGH_COLORS[b]}
            />
          ))}
        </div>
      )}

      {/* Ridership by Year */}
      <div className="chart-container">
        <div className="chart-title">Ridership by Borough and Year</div>
        <div className="chart-subtitle">Total paid rides per borough per year</div>
        {loading.ridership && <LoadingSpinner />}
        {errors.ridership && <ErrorMessage message={errors.ridership} onRetry={fetchAll} />}
        {!loading.ridership && !errors.ridership && (
          <div className="ui-fade-in">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={ridershipPivoted} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                {activeBoroughs.map((b) => (
                  <Bar key={b} dataKey={b} fill={BOROUGH_COLORS[b]} name={b} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* ADA Stations */}
        <div className="chart-container">
          <div className="chart-title">ADA-Accessible Stations by Borough</div>
          <div className="chart-subtitle">Stations meeting ADA accessibility requirements</div>
          {loading.ada && <LoadingSpinner />}
          {errors.ada && <ErrorMessage message={errors.ada} onRetry={fetchAll} />}
          {!loading.ada && !errors.ada && (
            <div className="ui-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={adaData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                  <YAxis type="category" dataKey="borough" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="accessible_stations" name="Accessible Stations" radius={[0, 4, 4, 0]}>
                    {adaData.map((entry) => (
                      <Cell key={entry.borough} fill={BOROUGH_COLORS[entry.borough] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Evasion Intensity */}
        <div className="chart-container">
          <div className="chart-title">Estimated Evasion Intensity by Borough</div>
          <div className="chart-subtitle">Avg. estimated evaded rides per 100k riders (all years)</div>
          {loading.intensity && <LoadingSpinner />}
          {errors.intensity && <ErrorMessage message={errors.intensity} onRetry={fetchAll} />}
          {!loading.intensity && !errors.intensity && (
            <div className="ui-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={intensityChartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                  <YAxis type="category" dataKey="borough" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_intensity" name="Avg Evaded / 100k Riders" radius={[0, 4, 4, 0]}>
                    {intensityChartData.map((entry) => (
                      <Cell key={entry.borough} fill={BOROUGH_COLORS[entry.borough] || "#f59e0b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Latest Year Intensity Table */}
      {!loading.intensity && !errors.intensity && latestIntensity.length > 0 && (
        <div className="chart-container ui-fade-in">
          <div className="chart-title">Evasion Intensity Detail — Latest Year ({latestIntensity[0]?.year})</div>
          <div className="table-container" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Borough</th>
                  <th>Paid Rides</th>
                  <th>Est. Evaded Rides</th>
                  <th>Est. Evaded per 100k Riders</th>
                </tr>
              </thead>
              <tbody>
                {latestIntensity.map((row) => (
                  <tr key={row.borough}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: BOROUGH_COLORS[row.borough] || "#64748b", display: "inline-block"
                        }} />
                        {row.borough}
                      </span>
                    </td>
                    <td>{fmt(row.paid_rides)}</td>
                    <td>{fmt(row.est_evaded_rides)}</td>
                    <td>
                      <span className={
                        row.est_evaded_per_100k_riders > 10000 ? "badge badge-red" :
                        row.est_evaded_per_100k_riders > 5000 ? "badge badge-yellow" : "badge badge-green"
                      }>
                        {fmt(row.est_evaded_per_100k_riders)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
