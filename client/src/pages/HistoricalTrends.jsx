import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";

const COLORS = { ridership: "#3b82f6", evasion: "#f59e0b", positive: "#10b981", negative: "#ef4444" };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Year: {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginTop: 3 }}>
          {p.name}: <strong>{p.value != null ? p.value.toLocaleString() : "N/A"}</strong>
        </div>
      ))}
    </div>
  );
}

export default function HistoricalTrends() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (yearStart) params.year_start = yearStart;
      if (yearEnd) params.year_end = yearEnd;
      const res = await api.get("/trends/ridership-vs-evasion", { params });
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [yearStart, yearEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latestYear = data.length ? data[data.length - 1] : null;
  const totalRidership = latestYear?.total_ridership;
  const evasionPct = latestYear?.evasion_pct;
  const yoyRidership = latestYear?.yoy_ridership_change_pct;
  const yoyEvasion = latestYear?.yoy_evasion_change_pct;

  const fmt = (n) => (n != null ? Number(n).toLocaleString() : "N/A");
  const fmtPct = (n) => (n != null ? `${Number(n).toFixed(2)}%` : "N/A");
  const fmtChange = (n) => (n != null ? `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%` : "N/A");

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Historical Trend Analysis</h1>
        <p>Annual ridership vs. estimated fare evasion rate over time</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Year Start</label>
          <input
            type="number"
            placeholder="e.g. 2020"
            value={yearStart}
            onChange={(e) => setYearStart(e.target.value)}
            min="2015"
            max="2030"
          />
        </div>
        <div className="filter-group">
          <label>Year End</label>
          <input
            type="number"
            placeholder="e.g. 2024"
            value={yearEnd}
            onChange={(e) => setYearEnd(e.target.value)}
            min="2015"
            max="2030"
          />
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchData}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => { setYearStart(""); setYearEnd(""); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Metric cards */}
      {!loading && !error && latestYear && (
        <div className="grid-4 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard
            label={`Total Ridership (${latestYear.year})`}
            value={fmt(totalRidership)}
            color={COLORS.ridership}
          />
          <MetricCard
            label={`Evasion Rate (${latestYear.year})`}
            value={fmtPct(evasionPct)}
            color={COLORS.evasion}
          />
          <MetricCard
            label="YoY Ridership Change"
            value={fmtChange(yoyRidership)}
            color={yoyRidership > 0 ? COLORS.positive : yoyRidership < 0 ? COLORS.negative : undefined}
            subValue="vs. prior year"
          />
          <MetricCard
            label="YoY Evasion Change"
            value={fmtChange(yoyEvasion)}
            color={yoyEvasion > 0 ? COLORS.negative : yoyEvasion < 0 ? COLORS.positive : undefined}
            subValue="vs. prior year"
          />
        </div>
      )}

      {loading && <LoadingSpinner message="Loading trend data..." />}
      {error && <ErrorMessage message={error} onRetry={fetchData} />}

      {!loading && !error && data.length > 0 && (
        <div className="ui-fade-in">
          {/* Ridership Chart */}
          <div className="chart-container">
            <div className="chart-title">Annual Ridership Over Time</div>
            <div className="chart-subtitle">Total paid rides per year across all MTA subway stations</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="total_ridership"
                  stroke={COLORS.ridership}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.ridership }}
                  activeDot={{ r: 6 }}
                  name="Total Ridership"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Evasion Rate Chart */}
          <div className="chart-container">
            <div className="chart-title">Estimated Fare Evasion Rate Over Time</div>
            <div className="chart-subtitle">Annual average evasion rate (%) derived from MTA survey data</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Line
                  type="monotone"
                  dataKey="evasion_pct"
                  stroke={COLORS.evasion}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.evasion }}
                  activeDot={{ r: 6 }}
                  name="Evasion Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* YoY Change Chart */}
          <div className="chart-container">
            <div className="chart-title">Year-over-Year Change</div>
            <div className="chart-subtitle">Percentage change from prior year for ridership and evasion rate</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="yoy_ridership_change_pct"
                  stroke={COLORS.ridership}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="YoY Ridership Change (%)"
                />
                <Line
                  type="monotone"
                  dataKey="yoy_evasion_change_pct"
                  stroke={COLORS.evasion}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="YoY Evasion Change (%)"
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data Table */}
          <div className="chart-container">
            <div className="chart-title">Year-by-Year Summary</div>
            <div className="table-container" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Total Ridership</th>
                    <th>Evasion Rate</th>
                    <th>YoY Ridership</th>
                    <th>YoY Evasion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{fmt(row.total_ridership)}</td>
                      <td>{fmtPct(row.evasion_pct)}</td>
                      <td style={{ color: row.yoy_ridership_change_pct > 0 ? COLORS.positive : COLORS.negative }}>
                        {fmtChange(row.yoy_ridership_change_pct)}
                      </td>
                      <td style={{ color: row.yoy_evasion_change_pct > 0 ? COLORS.negative : COLORS.positive }}>
                        {fmtChange(row.yoy_evasion_change_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="ui-fade-in" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          No data found for the selected filters.
        </div>
      )}
    </div>
  );
}
