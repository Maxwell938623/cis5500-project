import React from "react";

const AVAILABLE_YEARS = [2020, 2021, 2022, 2023, 2024];

export default function YearMultiSelect({
  value = [],
  onChange,
  label = "Years",
  availableYears = AVAILABLE_YEARS,
}) {
  const selected = new Set(value);
  const allSelected =
    availableYears.length > 0 &&
    availableYears.every((y) => selected.has(y));

  function toggle(year) {
    const next = new Set(selected);
    if (next.has(year)) {
      next.delete(year);
    } else {
      next.add(year);
    }
    const sorted = availableYears.filter((y) => next.has(y));
    onChange?.(sorted);
  }

  function toggleAll() {
    if (allSelected) {
      onChange?.([]);
    } else {
      onChange?.([...availableYears]);
    }
  }

  return (
    <div className="filter-group year-multi-select">
      <label>{label}</label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <YearPill active={allSelected} onClick={toggleAll} variant="all">
          All
        </YearPill>
        {availableYears.map((y) => (
          <YearPill
            key={y}
            active={selected.has(y)}
            onClick={() => toggle(y)}
          >
            {y}
          </YearPill>
        ))}
      </div>
    </div>
  );
}

function YearPill({ active, onClick, children, variant }) {
  const isAll = variant === "all";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: "0.8rem",
        fontWeight: 600,
        cursor: "pointer",
        background: active
          ? isAll
            ? "var(--accent)"
            : "var(--accent-light)"
          : "var(--input-bg)",
        color: active
          ? isAll
            ? "var(--white)"
            : "var(--white)"
          : "var(--text-secondary)",
        border: active
          ? `1px solid ${isAll ? "var(--accent)" : "var(--accent)"}`
          : "1px solid var(--border)",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
        minWidth: isAll ? 48 : 60,
      }}
    >
      {children}
    </button>
  );
}
