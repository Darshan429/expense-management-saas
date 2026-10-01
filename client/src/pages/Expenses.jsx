import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useReceiptScanner } from "../hooks/useReceiptScanner";
import api from "../api/axios";
import toast from "react-hot-toast";

const CATEGORIES = ["Travel", "Meals", "Software", "Office", "Other"];
const STATUSES = ["All", "Pending", "Approved", "Rejected"];

const STATUS_STYLE = {
  Pending: { background: "#FEF3E2", color: "#BA7517" },
  Approved: { background: "#E8F8F2", color: "#1D9E75" },
  Rejected: { background: "#FEE8E8", color: "#D85A30" },
};

const fmt = (n) => `Rs.${parseFloat(n || 0).toLocaleString("en-IN")}`;

export default function Expenses() {
  const { user, isManager, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCat, setFilterCat] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Approval modal state
  const [approving, setApproving] = useState(null); // expense being approved
  const [actionForm, setActionForm] = useState({
    status: "Approved",
    remarks: "",
  });

  // Expense form state
  const [form, setForm] = useState({
    amount: "",
    category: "",
    description: "",
    department_id: user?.department_id || "",
  });
  const [receiptFile, setReceiptFile] = useState(null);

  const { scanning, preview, scanError, scanReceipt } = useReceiptScanner();

  useEffect(() => {
    fetchExpenses();
  }, []); // fetch once on mount

  // Separate effect for filter changes
  useEffect(() => {
    if (filterStatus || filterCat) fetchExpenses();
  }, [filterStatus, filterCat]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "All") params.append("status", filterStatus);
      if (filterCat) params.append("category", filterCat);

      const { data } = await api.get(`/expenses?${params}`);
      setExpenses(data);
    } catch (err) {
      console.error("Fetch expenses error:", err); // log silently
      // Only show toast if it's not a known issue
      if (err.response?.status !== 500) {
        toast.error("Failed to load expenses");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Submit expense ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.category) {
      toast.error("Amount and category are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("amount", form.amount);
      payload.append("category", form.category);
      payload.append("description", form.description);
      if (form.department_id)
        payload.append("department_id", form.department_id);
      if (receiptFile) payload.append("receipt", receiptFile);

      await api.post("/expenses", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Expense submitted successfully");
      setShowForm(false);
      resetForm();
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      amount: "",
      category: "",
      description: "",
      department_id: user?.department_id || "",
    });
    setReceiptFile(null);
  };

  // ── Handle receipt upload + AI scan ──────────────────────────────────────
  const handleReceiptChange = (file) => {
    if (!file) return;
    setReceiptFile(file);
    scanReceipt(file, setForm);
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const handleApproval = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/expenses/${approving.id}/approve`, actionForm);
      toast.success(`Expense ${actionForm.status.toLowerCase()} successfully`);
      setApproving(null);
      setActionForm({ status: "Approved", remarks: "" });
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  // ── Delete expense ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success("Expense deleted");
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  // ── Filter client-side by search ──────────────────────────────────────────
  const filtered = expenses.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.category?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.submittedBy?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={S.page}>
      {/* ── Page Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Expenses</h1>
          <p style={S.sub}>
            {isAdmin
              ? "All company expenses"
              : isManager
                ? "Your department expenses"
                : "Your submitted expenses"}
          </p>
        </div>
        {!isManager && !isAdmin && (
          <button onClick={() => setShowForm(true)} style={S.primaryBtn}>
            + Submit Expense
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={S.filterRow}>
        <input
          placeholder="Search by category, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={S.searchInput}
        />
        <div style={S.pills}>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                ...S.pill,
                background: filterStatus === s ? "#378ADD" : "#fff",
                color: filterStatus === s ? "#fff" : "#555",
                borderColor: filterStatus === s ? "#378ADD" : "#e0e0e0",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={S.select}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* ── Expense Count ── */}
      <div style={S.countRow}>
        <span style={{ fontSize: 13, color: "#888" }}>
          {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
          {filterStatus !== "All" ? ` · ${filterStatus}` : ""}
        </span>
        <button onClick={fetchExpenses} style={S.refreshBtn}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Expense List ── */}
      {loading ? (
        <div style={S.loadingWrap}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ color: "#888", fontSize: 14 }}>
            {filterStatus !== "All" || filterCat
              ? "No expenses match your filters"
              : "No expenses yet"}
          </p>
          {!isManager && !isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              style={{ ...S.primaryBtn, marginTop: 16 }}
            >
              Submit your first expense
            </button>
          )}
        </div>
      ) : (
        <div style={S.list}>
          {/* Table header */}
          <div
            style={{
              ...S.listHeader,
              gridTemplateColumns:
                isAdmin || isManager ? "repeat(7, 1fr)" : "repeat(6, 1fr)",
            }}
          >
            {(isAdmin || isManager) && <span>Employee</span>}
            <span>Category</span>
            <span>Description</span>
            <span>Amount</span>
            <span>Date</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {filtered.map((expense) => (
            <div
              key={expense.id}
              style={{
                ...S.listRow,
                gridTemplateColumns:
                  isAdmin || isManager ? "repeat(7, 1fr)" : "repeat(6, 1fr)",
              }}
            >
              {(isAdmin || isManager) && (
                <div style={S.cell}>
                  <div style={S.avatar}>
                    {expense.SubmittedBy?.name?.[0] || "?"}
                  </div>
                  <span style={{ fontSize: 13, color: "#333" }}>
                    {expense.SubmittedBy?.name || "—"}
                  </span>
                </div>
              )}

              <div style={S.cell}>
                <span style={S.catBadge}>{expense.category}</span>
              </div>

              <div style={{ ...S.cell, maxWidth: 200 }}>
                <span style={S.desc}>{expense.description || "—"}</span>
              </div>

              <div style={S.cell}>
                <span style={{ fontWeight: 600, color: "#1a1a1a" }}>
                  {fmt(expense.amount)}
                </span>
              </div>

              <div style={S.cell}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  {expense.createdAt
                    ? new Date(expense.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>

              <div style={S.cell}>
                <span
                  style={{
                    ...S.statusBadge,
                    ...STATUS_STYLE[expense.status],
                  }}
                >
                  {expense.status}
                </span>
              </div>

              <div style={{ ...S.cell, gap: 6 }}>
                {/* View detail */}
                <button
                  onClick={() => navigate(`/expenses/${expense.id}`)}
                  style={S.iconBtn}
                  title="View details"
                >
                  👁
                </button>

                {/* Approve/Reject — managers and admins on pending expenses */}
                {(isManager || isAdmin) &&
                  String(expense.status).toLowerCase() === "pending" && (
                    <button
                      onClick={() => setApproving(expense)}
                      style={{
                        ...S.iconBtn,
                        background: "#EBF4FF",
                        color: "#378ADD",
                      }}
                      title="Approve or reject"
                    >
                      ✓
                    </button>
                  )}

                {/* Delete — own pending expense or admin */}
                {(isAdmin ||
                  (expense.user_id === user.id &&
                    expense.status === "Pending")) && (
                  <button
                    onClick={() => handleDelete(expense.id)}
                    style={{
                      ...S.iconBtn,
                      background: "#FEE8E8",
                      color: "#D85A30",
                    }}
                    title="Delete expense"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Submit Expense Modal ── */}
      {showForm && (
        <Modal
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
        >
          <h2 style={S.modalTitle}>Submit Expense</h2>

          {/* Receipt upload zone */}
          <div
            onClick={() => document.getElementById("receipt-input").click()}
            onDrop={(e) => {
              e.preventDefault();
              handleReceiptChange(e.dataTransfer.files[0]);
            }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              ...S.uploadZone,
              background: scanning
                ? "#EBF4FF"
                : preview
                  ? "#F0FFF8"
                  : "#fafafa",
              borderColor: scanning ? "#378ADD" : preview ? "#1D9E75" : "#ddd",
            }}
          >
            <input
              id="receipt-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleReceiptChange(e.target.files[0])}
            />
            {preview ? (
              <div style={{ textAlign: "center" }}>
                <img src={preview} alt="Receipt" style={S.previewImg} />
                {scanning && (
                  <p style={{ color: "#378ADD", fontSize: 13, marginTop: 8 }}>
                    ✦ Scanning with AI...
                  </p>
                )}
                {!scanning && (
                  <p style={{ color: "#1D9E75", fontSize: 12, marginTop: 6 }}>
                    ✓ Receipt scanned — form auto-filled below
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#aaa" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Drop receipt image here or click to upload
                </p>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  AI will auto-fill the form
                </p>
              </div>
            )}
            {scanError && (
              <p
                style={{
                  color: "#D85A30",
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {scanError} — fill in manually below
              </p>
            )}
          </div>

          {/* Expense form */}
          <form onSubmit={handleSubmit} style={S.modalForm}>
            <div style={S.formRow}>
              <div style={S.field}>
                <label style={S.label}>Amount (Rs.) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  style={S.input}
                  min="1"
                  step="0.01"
                />
              </div>
              <div style={S.field}>
                <label style={S.label}>Category *</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                  style={S.input}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="What was this expense for?"
                rows={3}
                style={{ ...S.input, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={S.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || scanning}
                style={{
                  ...S.primaryBtn,
                  flex: 1,
                  opacity: submitting || scanning ? 0.7 : 1,
                  cursor: submitting || scanning ? "not-allowed" : "pointer",
                }}
              >
                {submitting
                  ? "Submitting..."
                  : scanning
                    ? "Scanning receipt..."
                    : "Submit Expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Approve / Reject Modal ── */}
      {approving && (
        <Modal onClose={() => setApproving(null)}>
          <h2 style={S.modalTitle}>Review Expense</h2>

          {/* Expense summary */}
          <div style={S.expenseSummary}>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>Employee</span>
              <span style={S.summaryVal}>
                {approving.submittedBy?.name || "—"}
              </span>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>Amount</span>
              <span
                style={{
                  ...S.summaryVal,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#378ADD",
                }}
              >
                {fmt(approving.amount)}
              </span>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>Category</span>
              <span style={S.catBadge}>{approving.category}</span>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>Description</span>
              <span style={S.summaryVal}>{approving.description || "—"}</span>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>Submitted</span>
              <span style={S.summaryVal}>
                {approving.created_at
                  ? new Date(approving.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
            {approving.receipt_url && (
              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>Receipt</span>
                <a
                  href={approving.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#378ADD", fontSize: 13 }}
                >
                  View receipt →
                </a>
              </div>
            )}
          </div>

          <form onSubmit={handleApproval} style={S.modalForm}>
            {/* Approve / Reject toggle */}
            <div style={S.field}>
              <label style={S.label}>Decision</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["Approved", "Rejected"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActionForm((p) => ({ ...p, status: s }))}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 8,
                      border: "1.5px solid",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      transition: "all .2s",
                      borderColor:
                        actionForm.status === s
                          ? s === "Approved"
                            ? "#1D9E75"
                            : "#D85A30"
                          : "#e0e0e0",
                      background:
                        actionForm.status === s
                          ? s === "Approved"
                            ? "#E8F8F2"
                            : "#FEE8E8"
                          : "#fafafa",
                      color:
                        actionForm.status === s
                          ? s === "Approved"
                            ? "#1D9E75"
                            : "#D85A30"
                          : "#888",
                    }}
                  >
                    {s === "Approved" ? "✓ Approve" : "✕ Reject"}
                  </button>
                ))}
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>
                Comment{" "}
                {actionForm.status === "Rejected" ? "(required)" : "(optional)"}
              </label>
              <textarea
                value={actionForm.remarks}
                onChange={(e) =>
                  setActionForm((p) => ({ ...p, remarks: e.target.value }))
                }
                placeholder={
                  actionForm.status === "Rejected"
                    ? "Explain why this expense is rejected..."
                    : "Add an optional note..."
                }
                rows={3}
                style={{ ...S.input, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setApproving(null)}
                style={S.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  ...S.primaryBtn,
                  flex: 1,
                  background:
                    actionForm.status === "Approved" ? "#1D9E75" : "#D85A30",
                }}
              >
                Confirm {actionForm.status}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={S.closeBtn}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ ...S.listRow, pointerEvents: "none" }}>
      {[200, 100, 140, 80, 90, 80, 60].map((w, i) => (
        <div
          key={i}
          style={{
            width: w,
            height: 14,
            background: "#f0f0f0",
            borderRadius: 6,
            animation: "pulse 1.5s infinite",
          }}
        />
      ))}
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
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    padding: "8px 14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    background: "#fafafa",
  },
  pills: { display: "flex", gap: 6 },
  pill: {
    padding: "6px 12px",
    borderRadius: 16,
    border: "1px solid",
    fontSize: 12,
    cursor: "pointer",
    transition: "all .15s",
    fontWeight: 500,
  },
  select: {
    padding: "8px 12px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 13,
    background: "#fafafa",
    outline: "none",
    cursor: "pointer",
  },
  countRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 8px",
  },
  loadingWrap: { display: "flex", flexDirection: "column", gap: 1 },
  empty: {
    textAlign: "center",
    padding: "60px 0",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #f0f0f0",
  },
  list: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #f0f0f0",
    overflow: "hidden",
  },
  // Change them back to this:
  listHeader: {
    display: "grid",
    gap: 12,
    padding: "12px 20px",
    background: "#f8f9fa",
    borderBottom: "1px solid #f0f0f0",
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
  listRow: {
    display: "grid",
    gap: 12,
    padding: "14px 20px",
    borderBottom: "1px solid #f9f9f9",
    alignItems: "center",
    transition: "background .15s",
  },
  cell: { display: "flex", alignItems: "center", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#EBF4FF",
    color: "#378ADD",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  catBadge: {
    padding: "3px 10px",
    background: "#EBF4FF",
    color: "#378ADD",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 500,
  },
  desc: {
    fontSize: 13,
    color: "#555",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 180,
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#f5f5f5",
    color: "#555",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    position: "relative",
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
  uploadZone: {
    border: "2px dashed",
    borderRadius: 10,
    padding: "20px 16px",
    marginBottom: 20,
    cursor: "pointer",
    transition: "all .2s",
  },
  previewImg: {
    maxHeight: 120,
    maxWidth: "100%",
    borderRadius: 6,
    objectFit: "contain",
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
  expenseSummary: {
    background: "#f8f9fa",
    borderRadius: 10,
    padding: "16px",
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 12, color: "#888", fontWeight: 500 },
  summaryVal: {
    fontSize: 13,
    color: "#333",
    fontWeight: 500,
    textAlign: "right",
    maxWidth: "60%",
  },
};
