import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const fmt = (n) => {
  const num = parseFloat(n) || 0;
  if (num >= 100000) return `Rs.${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `Rs.${(num / 1000).toFixed(1)}K`;
  return `Rs.${num.toFixed(0)}`;
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function Budgets() {
  const { isAdmin } = useAuth();

  const [budgets, setBudgets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const [form, setForm] = useState({
    department_id: "",
    allocated_amount: "",
    month: currentMonth,
    year: currentYear,
  });

  useEffect(() => {
    fetchBudgets();
    if (isAdmin) fetchDepartments();
  }, [filterMonth, filterYear]);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/budgets?month=${filterMonth}&year=${filterYear}`,
      );
      setBudgets(data);
    } catch (err) {
      toast.error("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get("/admin/departments");
      setDepartments(data);
    } catch {
      /* silent */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.department_id || !form.allocated_amount) {
      toast.error("Department and amount are required");
      return;
    }
    if (parseFloat(form.allocated_amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      if (editBudget) {
        await api.patch(`/budgets/${editBudget.id}`, {
          allocated_amount: form.allocated_amount,
        });
        toast.success("Budget updated");
      } else {
        await api.post("/budgets", form);
        toast.success("Budget created");
      }
      setShowForm(false);
      setEditBudget(null);
      resetForm();
      fetchBudgets();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save budget");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      department_id: "",
      allocated_amount: "",
      month: currentMonth,
      year: currentYear,
    });
  };

  const openEdit = (budget) => {
    setEditBudget(budget);
    setForm({
      department_id: budget.department_id,
      allocated_amount: budget.allocated_amount,
      month: budget.month,
      year: budget.year,
    });
    setShowForm(true);
  };

  const getBurnColor = (pct) => {
    if (pct >= 100) return "#D85A30";
    if (pct >= 80) return "#BA7517";
    return "#1D9E75";
  };

  const getBurnBg = (pct) => {
    if (pct >= 100) return "#FEE8E8";
    if (pct >= 80) return "#FEF3E2";
    return "#E8F8F2";
  };

  // Summary stats
  const totalAllocated = budgets.reduce(
    (s, b) => s + parseFloat(b.allocated_amount || 0),
    0,
  );
  const totalUsed = budgets.reduce(
    (s, b) => s + parseFloat(b.used_amount || 0),
    0,
  );
  const overBudget = budgets.filter(
    (b) => parseFloat(b.burn_pct) >= 100,
  ).length;
  const atRisk = budgets.filter(
    (b) => parseFloat(b.burn_pct) >= 80 && parseFloat(b.burn_pct) < 100,
  ).length;

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Budgets</h1>
          <p style={S.sub}>
            {MONTHS[filterMonth - 1]} {filterYear} — department budget overview
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setEditBudget(null);
              setShowForm(true);
            }}
            style={S.primaryBtn}
          >
            + Create Budget
          </button>
        )}
      </div>

      {/* ── Month / Year Filter ── */}
      <div style={S.filterRow}>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Month</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            style={S.select}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Year</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            style={S.select}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button onClick={fetchBudgets} style={S.refreshBtn}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Summary KPI cards ── */}
      <div style={S.kpiGrid}>
        <div style={{ ...S.kpiCard, borderTop: "4px solid #378ADD" }}>
          <div style={S.kpiLabel}>Total Allocated</div>
          <div style={{ ...S.kpiVal, color: "#378ADD" }}>
            {fmt(totalAllocated)}
          </div>
          <div style={S.kpiSub}>
            {budgets.length} department{budgets.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: "4px solid #1D9E75" }}>
          <div style={S.kpiLabel}>Total Used</div>
          <div style={{ ...S.kpiVal, color: "#1D9E75" }}>{fmt(totalUsed)}</div>
          <div style={S.kpiSub}>
            {fmt(totalAllocated - totalUsed)} remaining
          </div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: "4px solid #D85A30" }}>
          <div style={S.kpiLabel}>Over Budget</div>
          <div style={{ ...S.kpiVal, color: "#D85A30" }}>{overBudget}</div>
          <div style={S.kpiSub}>
            department{overBudget !== 1 ? "s" : ""} exceeded
          </div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: "4px solid #BA7517" }}>
          <div style={S.kpiLabel}>At Risk</div>
          <div style={{ ...S.kpiVal, color: "#BA7517" }}>{atRisk}</div>
          <div style={S.kpiSub}>between 80–100%</div>
        </div>
      </div>

      {/* ── Budget Cards ── */}
      {loading ? (
        <div style={S.cardGrid}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 4 }}>
            No budgets for {MONTHS[filterMonth - 1]} {filterYear}
          </p>
          {isAdmin && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              style={{ ...S.primaryBtn, marginTop: 16 }}
            >
              Create first budget
            </button>
          )}
        </div>
      ) : (
        <div style={S.cardGrid}>
          {budgets.map((budget) => {
            const pct = parseFloat(budget.burn_pct) || 0;
            const used = parseFloat(budget.used_amount) || 0;
            const allocated = parseFloat(budget.allocated_amount) || 0;
            const remaining = parseFloat(budget.remaining_amount) || 0;
            const burnColor = getBurnColor(pct);
            const burnBg = getBurnBg(pct);

            return (
              <div key={budget.id} style={S.budgetCard}>
                {/* Card header */}
                <div style={S.budgetCardHeader}>
                  <div>
                    <div style={S.deptName}>{budget.department_name}</div>
                    <div style={S.periodLabel}>
                      {MONTHS[budget.month - 1]} {budget.year}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        ...S.burnBadge,
                        background: burnBg,
                        color: burnColor,
                      }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                    {pct >= 100 && (
                      <span style={S.alertPill}>⚠ Over budget</span>
                    )}
                    {pct >= 80 && pct < 100 && (
                      <span
                        style={{
                          ...S.alertPill,
                          background: "#FEF3E2",
                          color: "#BA7517",
                        }}
                      >
                        ⚠ At 80%
                      </span>
                    )}
                  </div>
                </div>

                {/* Burn rate bar */}
                <div style={S.burnSection}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#888",
                      marginBottom: 8,
                    }}
                  >
                    <span>Burn rate</span>
                    <span style={{ fontWeight: 500, color: burnColor }}>
                      {fmt(used)} / {fmt(allocated)}
                    </span>
                  </div>
                  <div style={S.burnTrack}>
                    <div
                      style={{
                        ...S.burnFill,
                        width: `${Math.min(pct, 100)}%`,
                        background: burnColor,
                      }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div style={S.statsRow}>
                  <div style={S.stat}>
                    <div style={S.statLabel}>Allocated</div>
                    <div style={{ ...S.statVal, color: "#378ADD" }}>
                      {fmt(allocated)}
                    </div>
                  </div>
                  <div style={S.statDivider} />
                  <div style={S.stat}>
                    <div style={S.statLabel}>Used</div>
                    <div style={{ ...S.statVal, color: burnColor }}>
                      {fmt(used)}
                    </div>
                  </div>
                  <div style={S.statDivider} />
                  <div style={S.stat}>
                    <div style={S.statLabel}>Remaining</div>
                    <div
                      style={{
                        ...S.statVal,
                        color: remaining < 0 ? "#D85A30" : "#1D9E75",
                      }}
                    >
                      {remaining < 0 ? "-" : ""}
                      {fmt(Math.abs(remaining))}
                    </div>
                  </div>
                </div>

                {/* Alert flags */}
                <div style={S.flagRow}>
                  <span
                    style={{
                      ...S.flag,
                      background: budget.alert_80_sent ? "#E8F8F2" : "#f5f5f5",
                      color: budget.alert_80_sent ? "#1D9E75" : "#aaa",
                    }}
                  >
                    {budget.alert_80_sent ? "✓" : "○"} 80% alert sent
                  </span>
                  <span
                    style={{
                      ...S.flag,
                      background: budget.alert_100_sent ? "#FEE8E8" : "#f5f5f5",
                      color: budget.alert_100_sent ? "#D85A30" : "#aaa",
                    }}
                  >
                    {budget.alert_100_sent ? "✓" : "○"} 100% alert sent
                  </span>
                </div>

                {/* Edit button — Admin only */}
                {isAdmin && (
                  <button onClick={() => openEdit(budget)} style={S.editBtn}>
                    ✏ Edit allocated amount
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div
          style={S.overlay}
          onClick={() => {
            setShowForm(false);
            setEditBudget(null);
          }}
        >
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowForm(false);
                setEditBudget(null);
                resetForm();
              }}
              style={S.closeBtn}
            >
              ✕
            </button>

            <h2 style={S.modalTitle}>
              {editBudget ? "Edit Budget" : "Create Budget"}
            </h2>

            <form onSubmit={handleSubmit} style={S.modalForm}>
              {!editBudget && (
                <>
                  <div style={S.field}>
                    <label style={S.label}>Department *</label>
                    <select
                      value={form.department_id}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          department_id: e.target.value,
                        }))
                      }
                      style={S.input}
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={S.formRow}>
                    <div style={S.field}>
                      <label style={S.label}>Month *</label>
                      <select
                        value={form.month}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            month: Number(e.target.value),
                          }))
                        }
                        style={S.input}
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>Year *</label>
                      <select
                        value={form.year}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            year: Number(e.target.value),
                          }))
                        }
                        style={S.input}
                      >
                        {[currentYear - 1, currentYear, currentYear + 1].map(
                          (y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {editBudget && (
                <div style={S.editInfo}>
                  <div style={S.editRow}>
                    <span style={S.editLabel}>Department</span>
                    <span style={S.editVal}>{editBudget.department_name}</span>
                  </div>
                  <div style={S.editRow}>
                    <span style={S.editLabel}>Period</span>
                    <span style={S.editVal}>
                      {MONTHS[editBudget.month - 1]} {editBudget.year}
                    </span>
                  </div>
                  <div style={S.editRow}>
                    <span style={S.editLabel}>Current amount</span>
                    <span
                      style={{
                        ...S.editVal,
                        color: "#378ADD",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(editBudget.allocated_amount)}
                    </span>
                  </div>
                </div>
              )}

              <div style={S.field}>
                <label style={S.label}>
                  {editBudget
                    ? "New Allocated Amount (Rs.) *"
                    : "Allocated Amount (Rs.) *"}
                </label>
                <input
                  type="number"
                  value={form.allocated_amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, allocated_amount: e.target.value }))
                  }
                  placeholder="e.g. 50000"
                  style={S.input}
                  min="1"
                  autoFocus
                />
                {form.allocated_amount && (
                  <span style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    = {fmt(form.allocated_amount)}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditBudget(null);
                    resetForm();
                  }}
                  style={S.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...S.primaryBtn,
                    flex: 1,
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting
                    ? "Saving..."
                    : editBudget
                      ? "Update Budget"
                      : "Create Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  const skBase = { background: "#f0f0f0", borderRadius: 6 };
  return (
    <div style={{ ...S.budgetCard, pointerEvents: "none" }}>
      <div style={{ ...skBase, width: 140, height: 16, marginBottom: 8 }} />
      <div style={{ ...skBase, width: 80, height: 12, marginBottom: 20 }} />
      <div style={{ ...skBase, width: "100%", height: 8, marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1 }}>
            <div
              style={{ ...skBase, width: "60%", height: 10, marginBottom: 6 }}
            />
            <div style={{ ...skBase, width: "80%", height: 16 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    padding: "24px 28px",
    maxWidth: 1200,
    margin: "0 auto",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  sub: { fontSize: 13, color: "#888", margin: "4px 0 0" },
  filterRow: {
    display: "flex",
    gap: 16,
    alignItems: "flex-end",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
  select: {
    padding: "8px 12px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 13,
    background: "#fafafa",
    outline: "none",
    cursor: "pointer",
    color: "#1a1a1a",
  },
  refreshBtn: {
    padding: "8px 14px",
    background: "#f5f5f5",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
    color: "#555",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "16px 18px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: ".04em",
    marginBottom: 6,
  },
  kpiVal: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  kpiSub: { fontSize: 12, color: "#aaa" },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
  },
  budgetCard: {
    background: "#fff",
    borderRadius: 14,
    padding: "20px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    border: "1px solid #f0f0f0",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  budgetCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  deptName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 3,
  },
  periodLabel: { fontSize: 12, color: "#888" },
  burnBadge: {
    fontSize: 14,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 10,
  },
  alertPill: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 8,
    background: "#FEE8E8",
    color: "#D85A30",
  },
  burnSection: { display: "flex", flexDirection: "column", gap: 0 },
  burnTrack: {
    height: 8,
    background: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  burnFill: { height: "100%", borderRadius: 4, transition: "width .5s ease" },
  statsRow: { display: "flex", alignItems: "center" },
  stat: { flex: 1, textAlign: "center" },
  statLabel: {
    fontSize: 11,
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: ".04em",
    marginBottom: 4,
  },
  statVal: { fontSize: 16, fontWeight: 700 },
  statDivider: { width: 1, height: 32, background: "#f0f0f0", flexShrink: 0 },
  flagRow: { display: "flex", gap: 8 },
  flag: { fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 500 },
  editBtn: {
    width: "100%",
    padding: "8px",
    background: "#f8f9ff",
    color: "#378ADD",
    border: "1px solid #dce8ff",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  },
  empty: {
    textAlign: "center",
    padding: "80px 0",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #f0f0f0",
  },
  primaryBtn: {
    padding: "10px 20px",
    background: "#378ADD",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "#f0f0f0",
    color: "#555",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 480,
    position: "relative",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "#888",
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: "0 0 20px",
  },
  modalForm: { display: "flex", flexDirection: "column", gap: 16 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: "#555" },
  input: {
    padding: "9px 12px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    background: "#fafafa",
    color: "#1a1a1a",
    boxSizing: "border-box",
    width: "100%",
  },
  editInfo: {
    background: "#f8f9fa",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  editRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editLabel: { fontSize: 12, color: "#888" },
  editVal: { fontSize: 13, color: "#333", fontWeight: 500 },
};
