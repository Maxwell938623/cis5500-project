import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";

const COLORS = {
  ridership: "#3b82f6",
  arrests: "#ef4444",
  positive: "#10b981",
  negative: "#ef4444",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="custom-tooltip">
      <div className="label">{label} {row?.year ? `(${row.year})` : ""}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginTop: 3 }}>
          {p.name}: <strong>{p.value != null ? Number(p.value).toLocaleString() : "N/A"}</strong>
        </div>
      ))}
    </div>
  );
}

export default function HistoricalTrends() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState("2024");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (year) params.year = year;
      const res = await api.get("/trends/annual", { params });
      const withMonthLabels = (res.data || []).map((row) => ({
        ...row,
        month_label: MONTH_LABELS[(row.month || 1) - 1] || `M${row.month}`,
      }));
      setData(withMonthLabels);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, []);

  const latestMonth = data.length ? data[data.length - 1] : null;
  const fmt = (n) => (n != null ? Number(n).toLocaleString() : "N/A");
  const fmtChange = (n) => (n != null ? `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%` : "N/A");

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Historical Trend Analysis</h1>
        <p>Single-year ridership and fare-evasion arrests, broken down month by month</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Year</label>
          <input
            type="number" placeholder="e.g. 2024"
            value={year} onChange={(e) => setYear(e.target.value)}
            min="2015" max="2030"
          />
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchData}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => { setYear("2024"); }}>Clear</button>
        </div>
      </div>

      {!loading && !error && latestMonth && (
        <div className="grid-4 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard
            label={`Total Ridership (${latestMonth.month_label} ${latestMonth.year})`}
            value={fmt(latestMonth.total_ridership)}
            color={COLORS.ridership}
          />
          <MetricCard
            label={`Total Arrests (${latestMonth.month_label} ${latestMonth.year})`}
            value={fmt(latestMonth.total_arrests)}
            color={COLORS.arrests}
          />
          <MetricCard
            label="MoM Ridership Change"
            value={fmtChange(latestMonth.mom_ridership_change_pct)}
            color={
              latestMonth.mom_ridership_change_pct == null ? undefined :
              latestMonth.mom_ridership_change_pct > 0 ? COLORS.positive : COLORS.negative
            }
            subValue="vs. prior month"
          />
          <MetricCard
            label="MoM Arrest Change"
            value={fmtChange(latestMonth.mom_arrest_change_pct)}
            color={
              latestMonth.mom_arrest_change_pct == null ? undefined :
              latestMonth.mom_arrest_change_pct > 0 ? COLORS.negative : COLORS.positive
            }
            subValue="vs. prior month"
          />
        </div>
      )}

      {loading && <LoadingSpinner message="Loading trend data..." />}
      {error && <ErrorMessage message={error} onRetry={fetchData} />}

      {!loading && !error && data.length > 0 && (
        <div className="ui-fade-in">
          <div className="chart-container">
            <div className="chart-title">Monthly Ridership</div>
            <div className="chart-subtitle">Total paid rides by month for the selected year</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
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

          <div className="chart-container">
            <div className="chart-title">Monthly Fare Evasion Arrests</div>
            <div className="chart-subtitle">Total NYPD fare-evasion arrests by month for the selected year</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => Number(v).toLocaleString()}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="total_arrests"
                  stroke={COLORS.arrests}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.arrests }}
                  activeDot={{ r: 6 }}
                  name="Total Arrests"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Month-over-Month Change</div>
            <div className="chart-subtitle">Monthly percentage change for ridership and arrests</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
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
                  dataKey="mom_ridership_change_pct"
                  stroke={COLORS.ridership}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="MoM Ridership Change (%)"
                />
                <Line
                  type="monotone"
                  dataKey="mom_arrest_change_pct"
                  stroke={COLORS.arrests}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  strokeDasharray="5 3"
                  name="MoM Arrest Change (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Month-by-Month Summary</div>
            <div className="table-container" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Ridership</th>
                    <th>Total Arrests</th>
                    <th>MoM Ridership</th>
                    <th>MoM Arrests</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={`${row.year}-${row.month}`}>
                      <td><strong>{row.month_label}</strong></td>
                      <td>{fmt(row.total_ridership)}</td>
                      <td>{fmt(row.total_arrests)}</td>
                      <td style={{ color: row.mom_ridership_change_pct == null || Number(row.mom_ridership_change_pct) === 0 ? "var(--text-secondary)" : row.mom_ridership_change_pct > 0 ? COLORS.positive : COLORS.negative }}>
                        {fmtChange(row.mom_ridership_change_pct)}
                      </td>
                      <td style={{ color: row.mom_arrest_change_pct == null || Number(row.mom_arrest_change_pct) === 0 ? "var(--text-secondary)" : row.mom_arrest_change_pct > 0 ? COLORS.negative : COLORS.positive }}>
                        {fmtChange(row.mom_arrest_change_pct)}
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
