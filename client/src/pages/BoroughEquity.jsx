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

const CHARGE_COLORS = {
  F: "#ef4444",
  M: "#f59e0b",
  V: "#10b981",
};

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const VALID_CHARGE_TYPES = ["F", "M", "V"];

function fmt(n) { return n != null ? Number(n).toLocaleString() : "N/A"; }
function fmtRatio(n) { return n != null ? `${Number(n).toFixed(4)}%` : "N/A"; }

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
  const [adaData, setAdaData] = useState([]);
  const [chargeData, setChargeData] = useState([]);
  const [demographicData, setDemographicData] = useState([]);
  const [disparityData, setDisparityData] = useState([]);
  const [loading, setLoading] = useState({ ada: true, charge: true, demographic: true, disparity: true });
  const [errors, setErrors] = useState({});
  const [selectedBorough, setSelectedBorough] = useState("");
  const [year, setYear] = useState("2024");
  const [disparityYear, setDisparityYear] = useState("");

  const fetchAda = useCallback(async () => {
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
  }, []);

  const fetchCharge = useCallback(async () => {
    setLoading((l) => ({ ...l, charge: true }));
    try {
      const params = {};
      if (year) params.year = Number(year);
      const res = await api.get("/arrests/by-charge-year", { params });
      setChargeData(res.data);
      setErrors((e) => ({ ...e, charge: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, charge: err.message }));
    } finally {
      setLoading((l) => ({ ...l, charge: false }));
    }
  }, [year]);

  const fetchDemographic = useCallback(async () => {
    setLoading((l) => ({ ...l, demographic: true }));
    try {
      const params = {};
      if (selectedBorough) params.borough = selectedBorough;
      if (year) params.year = Number(year);
      const res = await api.get("/boroughs/demographic-arrests", { params });
      setDemographicData(res.data);
      setErrors((e) => ({ ...e, demographic: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, demographic: err.message }));
    } finally {
      setLoading((l) => ({ ...l, demographic: false }));
    }
  }, [selectedBorough, year]);

  const fetchDisparity = useCallback(async () => {
    setLoading((l) => ({ ...l, disparity: true }));
    try {
      const params = {};
      if (disparityYear) params.year = disparityYear;
      else if (year) params.year = Number(year);
      const res = await api.get("/boroughs/enforcement-disparity", { params });
      setDisparityData(res.data);
      setErrors((e) => ({ ...e, disparity: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, disparity: err.message }));
    } finally {
      setLoading((l) => ({ ...l, disparity: false }));
    }
  }, [disparityYear, year]);

  useEffect(() => {
    fetchAda();
    fetchCharge();
    fetchDemographic();
    fetchDisparity();
  }, []);

  // Pivot charge data by year: [{year, F, M, V}]
  const chargePivoted = React.useMemo(() => {
    const map = {};
    for (const row of chargeData) {
      const type = String(row.law_cat_cd || "").trim().toUpperCase();
      if (!VALID_CHARGE_TYPES.includes(type)) continue;
      if (!map[row.year]) map[row.year] = { year: row.year };
      map[row.year][type] = Number(row.arrest_count);
    }
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [chargeData]);

  const chargeTypes = VALID_CHARGE_TYPES.filter((type) =>
    chargePivoted.some((row) => Number.isFinite(Number(row[type])))
  );

  // Latest year disparity for bar chart
  const latestDisparityYear = disparityData.length
    ? Math.max(...disparityData.map((r) => r.year))
    : null;
  const latestDisparity = disparityData.filter((r) => r.year === latestDisparityYear);

  // Summary: total arrests from charge data
  const totalArrests = chargeData.reduce((s, r) => s + Number(r.arrest_count || 0), 0);
  const totalAdaStations = adaData.reduce((s, r) => s + Number(r.accessible_stations || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Borough-Level Equity Comparison</h1>
        <p>Enforcement disparities, demographic patterns, and accessibility across NYC boroughs</p>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Year</label>
          <input
            type="number"
            placeholder="e.g. 2024"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2020"
            max="2024"
            style={{ width: 120 }}
          />
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-primary" onClick={() => { fetchCharge(); fetchDemographic(); fetchDisparity(); }}>Apply</button>
        </div>
        <div className="filter-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="btn btn-ghost" onClick={() => setYear("2024")}>Clear</button>
        </div>
      </div>

      {/* Summary metric cards */}
      {!loading.charge && !loading.ada && (
        <div className="grid-3 ui-fade-in" style={{ marginBottom: 24 }}>
          <MetricCard label={`Total Arrests${year ? ` (${year})` : ""}`} value={fmt(totalArrests)} color="#ef4444" />
          <MetricCard label="ADA-Accessible Stations" value={fmt(totalAdaStations)} color="#3b82f6" />
          <MetricCard
            label="Boroughs with Data"
            value={[...new Set(disparityData.map((r) => r.borough))].length || "N/A"}
            color="#10b981"
          />
        </div>
      )}

      {/* Arrests by Charge Severity and Year (Query 3) */}
      <div className="chart-container">
        <div className="chart-title">Arrests by Charge Severity and Year</div>
        <div className="chart-subtitle">
          F = Felony &bull; M = Misdemeanor &bull; V = Violation, tracks whether enforcement has shifted toward more serious charges</div>
        {loading.charge && <LoadingSpinner />}
        {errors.charge && <ErrorMessage message={errors.charge} onRetry={fetchCharge} />}
        {!loading.charge && !errors.charge && chargePivoted.length > 0 && (
          <div className="ui-fade-in">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chargePivoted} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
                {chargeTypes.map((type) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    name={type === "F" ? "Felony (F)" : type === "M" ? "Misdemeanor (M)" : type === "V" ? "Violation (V)" : type}
                    fill={CHARGE_COLORS[type] || "#64748b"}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* ADA Stations (Query 5) */}
        <div className="chart-container">
          <div className="chart-title">ADA-Accessible Stations by Borough</div>
          <div className="chart-subtitle">Stations with full ADA accessibility (ADA = 1)</div>
          {loading.ada && <LoadingSpinner />}
          {errors.ada && <ErrorMessage message={errors.ada} onRetry={fetchAda} />}
          {!loading.ada && !errors.ada && (
            <div className="ui-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={adaData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                  <YAxis
                    type="category" dataKey="borough"
                    stroke="var(--text-secondary)"
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    width={100}
                  />
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

        {/* Enforcement Disparity ratio chart (Query 8) */}
        <div className="chart-container">
          <div className="chart-title">Arrest-to-Evasion Ratio by Borough</div>
          <div className="chart-subtitle">
            Selected year — arrests as % of estimated evaders; higher = heavier policing relative to evasion
          </div>
          {loading.disparity && <LoadingSpinner />}
          {errors.disparity && <ErrorMessage message={errors.disparity} onRetry={fetchDisparity} />}
          {!loading.disparity && !errors.disparity && latestDisparity.length > 0 && (
            <div className="ui-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={latestDisparity}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                  <YAxis
                    type="category" dataKey="borough"
                    stroke="var(--text-secondary)"
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="custom-tooltip">
                          <div className="label">{label} ({row?.year})</div>
                          <div style={{ color: "#ef4444", marginTop: 2 }}>
                            Arrest/Evasion Ratio: <strong>{fmtRatio(row?.arrest_to_evasion_ratio)}</strong>
                          </div>
                          <div style={{ color: "#f59e0b", marginTop: 2 }}>
                            Total Arrests: <strong>{fmt(row?.total_arrests)}</strong>
                          </div>
                          <div style={{ color: "#3b82f6", marginTop: 2 }}>
                            Est. Evaded Rides: <strong>{fmt(row?.est_evaded_rides)}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="arrest_to_evasion_ratio" name="Arrest/Evasion Ratio (%)" radius={[0, 4, 4, 0]}>
                    {latestDisparity.map((entry) => (
                      <Cell key={entry.borough} fill={BOROUGH_COLORS[entry.borough] || "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Enforcement Disparity full table (Query 8) */}
      <div className="chart-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 4 }}>Borough Enforcement Disparity Detail</div>
            <div className="chart-subtitle">Arrests vs. estimated evasion volume per borough per year</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div className="filter-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.75rem" }}>Filter Year</label>
              <input
                type="number" placeholder="Use page year"
                value={disparityYear} onChange={(e) => setDisparityYear(e.target.value)}
                min="2020" max="2024" style={{ width: 110 }}
              />
            </div>
            <button className="btn btn-primary" style={{ marginBottom: 0 }} onClick={fetchDisparity}>Apply</button>
            <button className="btn btn-ghost" style={{ marginBottom: 0 }} onClick={() => setDisparityYear("")}>Clear</button>
          </div>
        </div>

        {loading.disparity && <LoadingSpinner />}
        {errors.disparity && <ErrorMessage message={errors.disparity} onRetry={fetchDisparity} />}
        {!loading.disparity && !errors.disparity && disparityData.length > 0 && (
          <div className="table-container ui-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Borough</th>
                  <th>Year</th>
                  <th>Est. Evaded Rides</th>
                  <th>Total Arrests</th>
                  <th>Arrest / Evasion Ratio</th>
                </tr>
              </thead>
              <tbody>
                {disparityData.map((row, i) => (
                  <tr key={`${row.borough}-${row.year}-${i}`}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: BOROUGH_COLORS[row.borough] || "#64748b", display: "inline-block",
                        }} />
                        {row.borough}
                      </span>
                    </td>
                    <td>{row.year}</td>
                    <td>{fmt(row.est_evaded_rides)}</td>
                    <td>{fmt(row.total_arrests)}</td>
                    <td>
                      <span className={
                        Number(row.arrest_to_evasion_ratio) > 0.1 ? "badge badge-red" :
                        Number(row.arrest_to_evasion_ratio) > 0.05 ? "badge badge-yellow" : "badge badge-green"
                      }>
                        {fmtRatio(row.arrest_to_evasion_ratio)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Demographic Breakdown of Arrests (Query 4) */}
      <div className="chart-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 4 }}>Demographic Breakdown of Arrests by Borough</div>
            <div className="chart-subtitle">Age group and race breakdown of fare evasion enforcement</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div className="filter-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.75rem" }}>Filter Borough</label>
              <select value={selectedBorough} onChange={(e) => setSelectedBorough(e.target.value)} style={{ minWidth: 140 }}>
                <option value="">All Boroughs</option>
                {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ marginBottom: 0 }} onClick={fetchDemographic}>Apply</button>
            <button className="btn btn-ghost" style={{ marginBottom: 0 }} onClick={() => setSelectedBorough("")}>Clear</button>
          </div>
        </div>

        {loading.demographic && <LoadingSpinner />}
        {errors.demographic && <ErrorMessage message={errors.demographic} onRetry={fetchDemographic} />}
        {!loading.demographic && !errors.demographic && demographicData.length > 0 && (
          <div className="table-container ui-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Borough</th>
                  <th>Age Group</th>
                  <th>Race</th>
                  <th>Arrest Count</th>
                </tr>
              </thead>
              <tbody>
                {demographicData.map((row, i) => (
                  <tr key={`${row.borough}-${row.age_group}-${row.perp_race}-${i}`}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: BOROUGH_COLORS[row.borough] || "#64748b", display: "inline-block",
                        }} />
                        {row.borough}
                      </span>
                    </td>
                    <td>{row.age_group}</td>
                    <td>{row.perp_race}</td>
                    <td>{fmt(row.arrest_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

