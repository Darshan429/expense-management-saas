import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import ExportButtons from "../components/ExportButton";

// Add next to the range filter buttons in Dashboard header:

const COLORS = ["#378ADD", "#1D9E75", "#BA7517", "#D85A30", "#534AB7"];
const RANGES = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "This year" },
];

const fmt = (n) => {
  const num = parseFloat(n) || 0;
  if (num >= 100000) return `Rs.${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `Rs.${(num / 1000).toFixed(1)}K`;
  return `Rs.${num.toFixed(0)}`;
};

const STATUS_COLORS = {
  Approved: "#1D9E75",
  Pending: "#BA7517",
  Rejected: "#D85A30",
};

export default function Dashboard() {
  const { user, isAdmin, isManager } = useAuth();

  const [range, setRange] = useState("30d");
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [category, setCategory] = useState([]);
  const [topSpenders, setTopSpenders] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchAll();
  }, [range]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const requests = [
        api.get(`/analytics/summary?range=${range}`),
        api.get(`/analytics/monthly?range=6months`),
        api.get(`/analytics/category?range=${range}`),
      ];

      if (isAdmin || isManager) {
        requests.push(api.get(`/analytics/top-spenders?range=${range}`));
      }
      if (isAdmin) {
        requests.push(api.get(`/analytics/departments?range=${range}`));
      }

      const results = await Promise.all(requests);

      setSummary(results[0].data);
      setMonthly(results[1].data);
      setCategory(results[2].data);
      if (isAdmin || isManager) setTopSpenders(results[3].data);
      if (isAdmin) setDepartments(results[4].data);
    } catch (err) {
      toast.error("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={S.page}>
      {/* ── Page Header ── */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Dashboard</h1>
          <p style={S.pageSub}>
            {isAdmin
              ? "System-wide overview"
              : isManager
                ? `${user.name}'s department analytics`
                : `${user.name}'s expense summary`}
          </p>
        </div>

        {/* Range filter */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={S.rangeRow}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                style={{
                  ...S.rangeBtn,
                  background: range === r.value ? "#378ADD" : "#fff",
                  color: range === r.value ? "#fff" : "#555",
                  borderColor: range === r.value ? "#378ADD" : "#e0e0e0",
                  fontWeight: range === r.value ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <ExportButtons range={range} />
        </div>
      </div>

      {/* ── Tabs (Admin only) ── */}
      {isAdmin && (
        <div style={S.tabRow}>
          {["overview", "departments"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...S.tab,
                borderBottom:
                  activeTab === tab
                    ? "2px solid #378ADD"
                    : "2px solid transparent",
                color: activeTab === tab ? "#378ADD" : "#888",
                fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {tab === "overview" ? "Overview" : "Departments"}
            </button>
          ))}
        </div>
      )}

      {/* ── KPI Cards ── */}
      {summary && (
        <div style={S.kpiGrid}>
          <KPICard
            label="Total Approved Spend"
            value={fmt(summary.total_spend)}
            icon="💰"
            color="#378ADD"
            sub={`${summary.approved_count} approved expenses`}
          />
          <KPICard
            label="Pending Approval"
            value={summary.pending_count}
            icon="⏳"
            color="#BA7517"
            sub="Awaiting manager review"
          />
          <KPICard
            label="Approved"
            value={summary.approved_count}
            icon="✅"
            color="#1D9E75"
            sub={`Avg ${fmt(summary.avg_expense)} per expense`}
          />
          <KPICard
            label="Rejected"
            value={summary.rejected_count}
            icon="❌"
            color="#D85A30"
            sub={`${summary.total_count} total submitted`}
          />
        </div>
      )}

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <>
          {/* Charts Row */}
          <div style={S.chartsRow}>
            {/* Monthly Bar Chart */}
            <div style={S.chartCard}>
              <div style={S.chartHeader}>
                <span style={S.chartTitle}>Monthly Spend Trend</span>
                <span style={S.chartSub}>Last 6 months</span>
              </div>
              {monthly.length === 0 ? (
                <EmptyState message="No data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={monthly}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                      tick={{ fontSize: 11, fill: "#888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [fmt(v), "Spend"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #eee",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="total_spend"
                      fill="#378ADD"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category Pie Chart */}
            <div style={S.chartCard}>
              <div style={S.chartHeader}>
                <span style={S.chartTitle}>By Category</span>
                <span style={S.chartSub}>Approved only</span>
              </div>
              {category.length === 0 ? (
                <EmptyState message="No approved expenses" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={35}
                      >
                        {category.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Category legend */}
                  <div style={S.catLegend}>
                    {category.map((c, i) => (
                      <div key={c.category} style={S.catRow}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: COLORS[i % COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#555" }}>
                            {c.category}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#333",
                          }}
                        >
                          {fmt(c.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top Spenders Table */}
          {(isAdmin || isManager) && topSpenders.length > 0 && (
            <div style={S.tableCard}>
              <div style={S.chartHeader}>
                <span style={S.chartTitle}>Top Spenders</span>
                <span style={S.chartSub}>By approved amount</span>
              </div>
              <table style={S.table}>
                <thead>
                  <tr>
                    {[
                      "#",
                      "Name",
                      "Department",
                      "Total Spent",
                      "Expenses",
                      "Avg",
                    ].map((h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topSpenders.map((s, i) => (
                    <tr
                      key={s.id}
                      style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    >
                      <td style={S.td}>
                        <span
                          style={{
                            ...S.rank,
                            background:
                              i === 0
                                ? "#FFD700"
                                : i === 1
                                  ? "#C0C0C0"
                                  : i === 2
                                    ? "#CD7F32"
                                    : "#f0f0f0",
                            color: i < 3 ? "#fff" : "#888",
                          }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontWeight: 500 }}>{s.name}</td>
                      <td style={{ ...S.td, color: "#666" }}>
                        {s.department_name || "—"}
                      </td>
                      <td
                        style={{ ...S.td, color: "#378ADD", fontWeight: 600 }}
                      >
                        {fmt(s.total_spent)}
                      </td>
                      <td style={{ ...S.td, color: "#666" }}>
                        {s.expense_count}
                      </td>
                      <td style={{ ...S.td, color: "#666" }}>
                        {fmt(s.avg_expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Status breakdown — mini cards */}
          {summary && (
            <div style={S.statusRow}>
              {Object.entries(STATUS_COLORS).map(([status, color]) => {
                const count = summary[`${status.toLowerCase()}_count`] || 0;
                const total = summary.total_count || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} style={S.statusCard}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 13, color: "#555", fontWeight: 500 }}
                      >
                        {status}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>
                        {count}
                      </span>
                    </div>
                    <div style={S.statusTrack}>
                      <div
                        style={{
                          ...S.statusFill,
                          width: `${pct}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#aaa",
                        marginTop: 4,
                        display: "block",
                      }}
                    >
                      {pct}% of total
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Departments Tab (Admin only) ── */}
      {activeTab === "departments" && isAdmin && (
        <div style={S.tableCard}>
          <div style={S.chartHeader}>
            <span style={S.chartTitle}>Department Budget Burn Rate</span>
            <span style={S.chartSub}>Current month</span>
          </div>

          {departments.length === 0 ? (
            <EmptyState message="No department data available" />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: "8px 0",
              }}
            >
              {departments.map((dept) => {
                const pct = parseFloat(dept.burn_pct) || 0;
                const over = pct >= 100;
                const warn = pct >= 80;
                const barColor = over
                  ? "#D85A30"
                  : warn
                    ? "#BA7517"
                    : "#378ADD";

                return (
                  <div key={dept.department_id} style={S.deptRow}>
                    <div style={S.deptLeft}>
                      <span style={S.deptName}>{dept.department_name}</span>
                      <span style={S.deptSub}>
                        {dept.member_count} members · {dept.total_expenses}{" "}
                        expenses
                      </span>
                    </div>

                    <div style={S.deptCenter}>
                      <div style={S.burnTrack}>
                        <div
                          style={{
                            ...S.burnFill,
                            width: `${Math.min(pct, 100)}%`,
                            background: barColor,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#888" }}>
                          Rs.
                          {parseFloat(dept.total_spend || 0).toLocaleString(
                            "en-IN",
                          )}{" "}
                          spent
                        </span>
                        <span style={{ fontSize: 11, color: "#888" }}>
                          Rs.
                          {parseFloat(
                            dept.budget_allocated || 0,
                          ).toLocaleString("en-IN")}{" "}
                          budget
                        </span>
                      </div>
                    </div>

                    <div style={S.deptRight}>
                      <span
                        style={{
                          ...S.burnPill,
                          background: over
                            ? "#FEE8E8"
                            : warn
                              ? "#FEF3E2"
                              : "#EBF4FF",
                          color: over
                            ? "#D85A30"
                            : warn
                              ? "#BA7517"
                              : "#378ADD",
                        }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      {over && <span style={S.alertBadge}>Over budget!</span>}
                      {warn && !over && (
                        <span
                          style={{
                            ...S.alertBadge,
                            background: "#FEF3E2",
                            color: "#BA7517",
                          }}
                        >
                          At 80%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ label, value, icon, color, sub }) {
  return (
    <div style={{ ...S.kpiCard, borderTop: `4px solid ${color}` }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={S.kpiLabel}>{label}</div>
          <div style={{ ...S.kpiValue, color }}>{value}</div>
          <div style={S.kpiSub}>{sub}</div>
        </div>
        <span style={{ fontSize: 28 }}>{icon}</span>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div
      style={{
        padding: "40px 0",
        textAlign: "center",
        color: "#aaa",
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      {message}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={S.page}>
      <div style={{ ...S.pageHeader, marginBottom: 24 }}>
        <div>
          <div style={S.skeleton(200, 28)} />
          <div style={{ ...S.skeleton(140, 16), marginTop: 8 }} />
        </div>
      </div>
      <div style={S.kpiGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...S.kpiCard, borderTop: "4px solid #eee" }}>
            <div style={S.skeleton(120, 14)} />
            <div style={{ ...S.skeleton(80, 32), marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={S.chartsRow}>
        <div style={{ ...S.chartCard, height: 280 }}>
          <div style={S.skeleton(160, 16)} />
          <div style={{ ...S.skeleton("100%", 200), marginTop: 16 }} />
        </div>
        <div style={{ ...S.chartCard, height: 280 }}>
          <div style={S.skeleton(120, 16)} />
          <div style={{ ...S.skeleton("100%", 200), marginTop: 16 }} />
        </div>
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
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  pageSub: { fontSize: 13, color: "#888", margin: "4px 0 0" },
  rangeRow: { display: "flex", gap: 8 },
  rangeBtn: {
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid",
    fontSize: 13,
    cursor: "pointer",
    transition: "all .2s",
  },
  tabRow: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid #eee",
    marginBottom: 24,
  },
  tab: {
    padding: "10px 20px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    transition: "all .2s",
    textTransform: "capitalize",
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
    padding: "18px 20px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    transition: "box-shadow .2s",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: ".04em",
    marginBottom: 6,
  },
  kpiValue: { fontSize: 28, fontWeight: 700, margin: "0 0 4px" },
  kpiSub: { fontSize: 12, color: "#aaa" },
  chartsRow: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  chartCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "20px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 14, fontWeight: 600, color: "#333" },
  chartSub: { fontSize: 12, color: "#aaa" },
  catLegend: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginTop: 12,
  },
  catRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "20px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 11,
    color: "#888",
    fontWeight: 500,
    borderBottom: "1px solid #f0f0f0",
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
  td: { padding: "10px 12px", borderBottom: "1px solid #f9f9f9" },
  rank: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    fontSize: 11,
    fontWeight: 700,
  },
  statusRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 16,
  },
  statusCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "16px 18px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  statusTrack: {
    height: 6,
    background: "#f0f0f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  statusFill: { height: "100%", borderRadius: 3, transition: "width .5s" },
  deptRow: {
    display: "grid",
    gridTemplateColumns: "180px 1fr 100px",
    gap: 20,
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f5f5f5",
  },
  deptLeft: { display: "flex", flexDirection: "column", gap: 3 },
  deptName: { fontSize: 13, fontWeight: 600, color: "#333" },
  deptSub: { fontSize: 11, color: "#aaa" },
  deptCenter: { flex: 1 },
  deptRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  burnTrack: {
    height: 8,
    background: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  burnFill: { height: "100%", borderRadius: 4, transition: "width .5s" },
  burnPill: {
    padding: "3px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
  },
  alertBadge: {
    fontSize: 10,
    background: "#FEE8E8",
    color: "#D85A30",
    padding: "2px 7px",
    borderRadius: 8,
    fontWeight: 500,
  },
  skeleton: (w, h) => ({
    width: w,
    height: h,
    background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
    backgroundSize: "200% 100%",
    borderRadius: 6,
    animation: "shimmer 1.5s infinite",
  }),
};
