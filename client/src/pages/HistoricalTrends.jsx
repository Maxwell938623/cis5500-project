import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MetricCard from "../components/MetricCard";
import YearMultiSelect from "../components/YearMultiSelect";

const COLORS = {
  ridership: "#3b82f6",
  arrests: "#ef4444",
  positive: "#10b981",
  negative: "#ef4444",
};

const YEAR_COLORS = {
  2020: "#3b82f6",
  2021: "#10b981",
  2022: "#f59e0b",
  2023: "#a855f7",
  2024: "#ef4444",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
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
  const [years, setYears] = useState([2024]);
  const [appliedYears, setAppliedYears] = useState([2024]);

  const fetchData = useCallback(async () => {
    if (!years.length) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/trends/annual", { params: { years } });
      setData(res.data || []);
      setAppliedYears(years);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [years]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!years.length) {
      setData([]);
      setError(null);
    }
  }, [years]);

  const pivotedData = useMemo(() => {
    const byMonth = {};
    for (const row of data) {
      const m = row.month;
      if (!byMonth[m]) {
        byMonth[m] = {
          month: m,
          month_label: MONTH_LABELS[(m || 1) - 1] || `M${m}`,
        };
      }
      byMonth[m][`ridership_${row.year}`] = row.total_ridership;
      byMonth[m][`arrests_${row.year}`] = row.total_arrests;
      byMonth[m][`mom_ridership_${row.year}`] = row.mom_ridership_change_pct;
      byMonth[m][`mom_arrests_${row.year}`] = row.mom_arrest_change_pct;
    }
    return Object.values(byMonth).sort((a, b) => a.month - b.month);
  }, [data]);

  const presentYears = useMemo(
    () => Array.from(new Set(data.map((r) => r.year))).sort((a, b) => a - b),
    [data]
  );

  const totals = useMemo(() => {
    if (!data.length) return null;
    let totalRidership = 0;
    let totalArrests = 0;
    for (const row of data) {
      totalRidership += Number(row.total_ridership) || 0;
      totalArrests += Number(row.total_arrests) || 0;
    }
    return { totalRidership, totalArrests };
  }, [data]);

  const yearRangeLabel = useMemo(() => {
    if (!presentYears.length) return "";
    if (presentYears.length === 1) return `${presentYears[0]}`;
    const min = presentYears[0];
    const max = presentYears[presentYears.length - 1];
    const contiguous = presentYears.length === max - min + 1;
    return contiguous ? `${min}–${max}` : presentYears.join(", ");
  }, [presentYears]);

  const fmt = (n) => (n != null ? Number(n).toLocaleString() : "N/A");
  const fmtChange = (n) => (n != null ? `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%` : "N/A");
  const yearColor = (y) => YEAR_COLORS[y] || COLORS.ridership;

  const yearsKey = (arr) => [...arr].sort((a, b) => a - b).join(",");
  const selectionStale = years.length > 0 && yearsKey(years) !== yearsKey(appliedYears);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Historical Trend Analysis</h1>
        <p>Monthly ridership and fare-evasion arrests for one or more selected years</p>
      </div>

      <div className="filters-bar">
        <YearMultiSelect value={years} onChange={setYears} />
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchData} disabled={!years.length}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => setYears([2024])}>Clear</button>
        </div>
      </div>

      {years.length === 0 && (
        <div className="ui-fade-in" style={{
          textAlign: "center",
          padding: "32px 20px",
          marginBottom: 24,
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-secondary)",
        }}>
          Please select at least one year to view data.
        </div>
      )}

      {selectionStale && (
        <div className="ui-fade-in" style={{
          fontSize: "0.8rem",
          color: "var(--accent)",
          fontStyle: "italic",
          marginBottom: 12,
          paddingLeft: 4,
        }}>
          Selection changed &mdash; press Apply to refresh.
        </div>
      )}

      {!loading && !error && totals && (
        <div className="grid-2 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard
            label={`Total Ridership (${yearRangeLabel})`}
            value={fmt(totals.totalRidership)}
            color={COLORS.ridership}
            subValue={presentYears.length > 1 ? "Summed across selected years" : undefined}
          />
          <MetricCard
            label={`Total Arrests (${yearRangeLabel})`}
            value={fmt(totals.totalArrests)}
            color={COLORS.arrests}
            subValue={presentYears.length > 1 ? "Summed across selected years" : undefined}
          />
        </div>
      )}

      {loading && <LoadingSpinner message="Loading trend data..." />}
      {error && <ErrorMessage message={error} onRetry={fetchData} />}

      {!loading && !error && pivotedData.length > 0 && (
        <div className="ui-fade-in">
          <div className="chart-container">
            <div className="chart-title">Monthly Ridership</div>
            <div className="chart-subtitle">Total paid rides by month, one line per selected year</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pivotedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                {presentYears.map((y) => (
                  <Line
                    key={y}
                    type="monotone"
                    dataKey={`ridership_${y}`}
                    stroke={yearColor(y)}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: yearColor(y) }}
                    activeDot={{ r: 6 }}
                    name={`${y} Ridership`}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Monthly Fare Evasion Arrests</div>
            <div className="chart-subtitle">Total NYPD fare-evasion arrests by month, one line per selected year</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pivotedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => Number(v).toLocaleString()}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                {presentYears.map((y) => (
                  <Line
                    key={y}
                    type="monotone"
                    dataKey={`arrests_${y}`}
                    stroke={yearColor(y)}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: yearColor(y) }}
                    activeDot={{ r: 6 }}
                    name={`${y} Arrests`}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Month-over-Month Change</div>
            <div className="chart-subtitle">Monthly percentage change for ridership and arrests, per selected year</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pivotedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                {presentYears.map((y) => (
                  <Line
                    key={`mom-r-${y}`}
                    type="monotone"
                    dataKey={`mom_ridership_${y}`}
                    stroke={yearColor(y)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={`${y} MoM Ridership (%)`}
                    connectNulls
                  />
                ))}
                {presentYears.map((y) => (
                  <Line
                    key={`mom-a-${y}`}
                    type="monotone"
                    dataKey={`mom_arrests_${y}`}
                    stroke={yearColor(y)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    strokeDasharray="5 3"
                    name={`${y} MoM Arrests (%)`}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Month-by-Month Summary</div>
            <div className="table-container" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
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
                      <td>{row.year}</td>
                      <td><strong>{MONTH_LABELS[(row.month || 1) - 1] || `M${row.month}`}</strong></td>
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

      {!loading && !error && data.length === 0 && years.length > 0 && (
        <div className="ui-fade-in" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          No data found for the selected filters.
        </div>
      )}
    </div>
  );
}
