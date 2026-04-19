import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ErrorBar,
  ReferenceLine, Cell,
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

const PAYMENT_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

function fmt(n) {
  if (n == null) return "N/A";
  const num = Number(n);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : "N/A"; }
function fmtNum(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || "var(--white)", marginTop: 2 }}>
          {p.name}: <strong>{p.value != null ? (typeof p.value === "number" ? p.value.toLocaleString() : p.value) : "N/A"}</strong>
        </div>
      ))}
    </div>
  );
}

export default function FinancialImpact() {
  const [quarterlyData, setQuarterlyData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [loading, setLoading] = useState({ quarterly: true, revenue: true, payment: true });
  const [errors, setErrors] = useState({});
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [fareAmount, setFareAmount] = useState("2.90");
  const [paymentMethods, setPaymentMethods] = useState([]);

  const fetchQuarterly = useCallback(async () => {
    setLoading((l) => ({ ...l, quarterly: true }));
    try {
      const params = {};
      if (yearStart) params.year_start = yearStart;
      if (yearEnd) params.year_end = yearEnd;
      const res = await api.get("/fare-evasion/quarterly", { params });
      setQuarterlyData(res.data);
      setErrors((e) => ({ ...e, quarterly: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, quarterly: err.message }));
    } finally {
      setLoading((l) => ({ ...l, quarterly: false }));
    }
  }, [yearStart, yearEnd]);

  const fetchRevenue = useCallback(async () => {
    setLoading((l) => ({ ...l, revenue: true }));
    try {
      const params = { fare_amount: fareAmount };
      if (yearStart) params.year_start = yearStart;
      if (yearEnd) params.year_end = yearEnd;
      const res = await api.get("/fare-evasion/revenue-loss", { params });
      setRevenueData(res.data);
      setErrors((e) => ({ ...e, revenue: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, revenue: err.message }));
    } finally {
      setLoading((l) => ({ ...l, revenue: false }));
    }
  }, [yearStart, yearEnd, fareAmount]);

  const fetchPayment = useCallback(async () => {
    setLoading((l) => ({ ...l, payment: true }));
    try {
      const res = await api.get("/boroughs/payment-share");
      setPaymentData(res.data);
      const methods = [...new Set(res.data.map((r) => r.payment_method))];
      setPaymentMethods(methods);
      setErrors((e) => ({ ...e, payment: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, payment: err.message }));
    } finally {
      setLoading((l) => ({ ...l, payment: false }));
    }
  }, []);

  useEffect(() => {
    fetchQuarterly();
    fetchRevenue();
    fetchPayment();
  }, []);

  // Add error bar data to quarterly
  const quarterlyWithLabel = quarterlyData.map((r) => ({
    ...r,
    label: `${r.year} Q${r.quarter}`,
    evasionHigh: Number(r.evasion_pct) + Number(r.margin_of_error_pct || 0),
    evasionLow: Math.max(0, Number(r.evasion_pct) - Number(r.margin_of_error_pct || 0)),
    errorVal: Number(r.margin_of_error_pct || 0),
  }));

  // Summary metrics
  const totalRevenueLost = revenueData.reduce((s, r) => s + Number(r.est_revenue_lost_usd || 0), 0);
  const avgEvasionPct = quarterlyData.length
    ? (quarterlyData.reduce((s, r) => s + Number(r.evasion_pct), 0) / quarterlyData.length).toFixed(2)
    : null;
  const totalEvaded = revenueData.reduce((s, r) => s + Number(r.est_evaded_rides || 0), 0);

  // Payment pivot for stacked bar
  const boroughs = [...new Set(paymentData.map((r) => r.borough))].sort();
  const paymentPivoted = boroughs.map((b) => {
    const obj = { borough: b };
    for (const row of paymentData.filter((r) => r.borough === b)) {
      obj[row.payment_method] = Number(row.pct_of_borough);
    }
    return obj;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Financial Impact Analysis</h1>
        <p>Estimated revenue loss from fare evasion and payment method breakdown</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Fare Amount ($)</label>
          <input
            type="number" step="0.05" min="0.01"
            value={fareAmount} onChange={(e) => setFareAmount(e.target.value)}
            style={{ width: 120 }}
          />
        </div>
        <div className="filter-group">
          <label>Year Start</label>
          <input type="number" placeholder="e.g. 2020" value={yearStart} onChange={(e) => setYearStart(e.target.value)} min="2015" max="2030" />
        </div>
        <div className="filter-group">
          <label>Year End</label>
          <input type="number" placeholder="e.g. 2024" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} min="2015" max="2030" />
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={() => { fetchQuarterly(); fetchRevenue(); }}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => { setYearStart(""); setYearEnd(""); setFareAmount("2.90"); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Metric cards */}
      {!loading.revenue && !loading.quarterly && (
        <div className="grid-3 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard
            label="Total Est. Revenue Lost"
            value={fmt(totalRevenueLost)}
            color="#ef4444"
          />
          <MetricCard
            label="Total Est. Evaded Rides"
            value={fmtNum(totalEvaded)}
            color="#f59e0b"
          />
          <MetricCard
            label="Avg Evasion Rate (Quarterly)"
            value={avgEvasionPct != null ? `${avgEvasionPct}%` : "N/A"}
            color="#3b82f6"
          />
        </div>
      )}

      {/* Quarterly evasion chart with error bands */}
      <div className="chart-container">
        <div className="chart-title">Quarterly Fare Evasion Rate with Margin of Error</div>
        <div className="chart-subtitle">Estimated evasion rate (%) with survey margin of error per quarter</div>
        {loading.quarterly && <LoadingSpinner />}
        {errors.quarterly && <ErrorMessage message={errors.quarterly} onRetry={fetchQuarterly} />}
        {!loading.quarterly && !errors.quarterly && quarterlyWithLabel.length > 0 && (
          <div className="ui-fade-in">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={quarterlyWithLabel} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
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
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Evasion Rate (%)"
                >
                  <ErrorBar dataKey="errorVal" width={4} strokeWidth={1.5} stroke="#60a5fa" opacity={0.6} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Revenue loss chart */}
      <div className="chart-container">
        <div className="chart-title">Estimated Revenue Lost per Quarter</div>
        <div className="chart-subtitle">Revenue not collected due to estimated fare evasion (USD)</div>
        {loading.revenue && <LoadingSpinner />}
        {errors.revenue && <ErrorMessage message={errors.revenue} onRetry={fetchRevenue} />}
        {!loading.revenue && !errors.revenue && revenueData.length > 0 && (
          <div className="ui-fade-in">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={revenueData.map((r) => ({ ...r, label: `${r.year} Q${r.quarter}` }))}
                margin={{ top: 5, right: 20, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="custom-tooltip">
                        <div className="label">{label}</div>
                        <div style={{ color: "#ef4444", marginTop: 2 }}>
                          Revenue Lost: <strong>${Number(payload[0]?.value || 0).toLocaleString()}</strong>
                        </div>
                        <div style={{ color: "#f59e0b", marginTop: 2 }}>
                          Evaded Rides: <strong>{Number(payload[0]?.payload?.est_evaded_rides || 0).toLocaleString()}</strong>
                        </div>
                        <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                          Evasion Rate: <strong>{fmtPct(payload[0]?.payload?.evasion_rate * 100)}</strong>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="est_revenue_lost_usd" name="Revenue Lost (USD)" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="table-container" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Quarter</th>
                    <th>Paid Rides</th>
                    <th>Evasion Rate</th>
                    <th>Est. Evaded Rides</th>
                    <th>Est. Revenue Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map((row) => (
                    <tr key={`${row.year}-${row.quarter}`}>
                      <td>{row.year}</td>
                      <td>Q{row.quarter}</td>
                      <td>{fmtNum(row.total_paid_rides)}</td>
                      <td>{fmtPct(row.evasion_rate * 100)}</td>
                      <td>{fmtNum(row.est_evaded_rides)}</td>
                      <td style={{ color: "#ef4444", fontWeight: 600 }}>
                        {fmt(row.est_revenue_lost_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment method share */}
      <div className="chart-container">
        <div className="chart-title">Payment Method Share by Borough</div>
        <div className="chart-subtitle">Percentage of ridership by payment method per borough</div>
        {loading.payment && <LoadingSpinner />}
        {errors.payment && <ErrorMessage message={errors.payment} onRetry={fetchPayment} />}
        {!loading.payment && !errors.payment && paymentPivoted.length > 0 && (
          <div className="ui-fade-in">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={paymentPivoted} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="borough" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                {paymentMethods.map((method, i) => (
                  <Bar
                    key={method}
                    dataKey={method}
                    stackId="a"
                    fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]}
                    name={method}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
