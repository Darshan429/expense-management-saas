import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
  Pending:  { background: '#FEF3E2', color: '#BA7517' },
  Approved: { background: '#E8F8F2', color: '#1D9E75' },
  Rejected: { background: '#FEE8E8', color: '#D85A30' },
};

export default function ExpenseDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { isManager, isAdmin } = useAuth();

  const [expense,    setExpense]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [actionForm, setActionForm] = useState({ status: 'Approved', remarks: '' });
  const [submitting, setSubmitting] = useState(false);



  useEffect(() => { fetchExpense(); }, [id]);

  const fetchExpense = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/expenses/${id}`);
      setExpense(data);
    } catch {
      toast.error('Expense not found');
      navigate('/expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (e) => {
    e.preventDefault();
    if (actionForm.status === 'Rejected' && !actionForm.remarks.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/expenses/${id}/approve`, actionForm);
      toast.success(`Expense ${actionForm.status.toLowerCase()} successfully`);
      fetchExpense();   // reload to show updated status
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n) => `Rs.${parseFloat(n || 0).toLocaleString('en-IN')}`;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#888',
                  fontFamily: '-apple-system, sans-serif' }}>
      <div style={spinnerStyle} />
      <p style={{ marginTop: 16 }}>Loading expense...</p>
    </div>
  );

  if (!expense) return null;

  const canApprove  = (isManager || isAdmin) && expense.status === 'Pending';
  const submittedBy = expense.SubmittedBy || expense.submittedBy;

  return (
    <div style={S.page}>

      {/* ── Back button ── */}
      <button onClick={() => navigate('/expenses')} style={S.backBtn}>
        ← Back to Expenses
      </button>

      <div style={S.card}>

        {/* ── Header ── */}
        <div style={S.cardHeader}>
          <div>
            <h1 style={S.title}>Expense #{expense.id}</h1>
            <p style={S.sub}>
              Submitted by {submittedBy?.name || 'Unknown'}
            </p>
          </div>
          <span style={{ ...S.statusBadge, ...STATUS_STYLE[expense.status] }}>
            {expense.status}
          </span>
        </div>

        {/* ── Details ── */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Expense Details</h3>
          <div style={S.detailGrid}>
            <DetailRow label="Amount"      value={fmt(expense.amount)} bold />
            <DetailRow label="Category"    value={expense.category} />
            <DetailRow label="Description" value={expense.description || '—'} />
            <DetailRow label="Submitted"   value={formatDate(expense.createdAt || expense.created_at)} />
            <DetailRow label="Department"
              value={expense.department?.name || `Dept #${expense.department_id}` || '—'} />
            {/* ✅ CORRECT */}
{expense.receipt_url && (
  <div style={S.detailRow}>
    <span style={S.detailLabel}>Receipt</span>
    
    <a 
      href={expense.receipt_url}
      target="_blank"
      rel="noreferrer"
      style={{ color: '#378ADD', fontSize: 13, fontWeight: 500 }}
    >
      View receipt →
    </a>
  </div>
)}
          </div>
        </div>

        {/* ── Submitter info ── */}
        {submittedBy && (
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Submitted By</h3>
            <div style={S.personCard}>
              <div style={S.avatar}>
                {submittedBy.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                  {submittedBy.name}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {submittedBy.email}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Approve / Reject form — managers + admins on pending ── */}
        {canApprove && (
          <div style={S.approvalSection}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#1a1a1a' }}>
              Review this expense
            </h3>
            <form onSubmit={handleApproval} style={S.approvalForm}>

              {/* Decision toggle */}
              <div style={{ display: 'flex', gap: 10 }}>
                {['Approved', 'Rejected'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActionForm(p => ({ ...p, status: s }))}
                    style={{
                      flex:         1,
                      padding:      '11px',
                      borderRadius: 8,
                      border:       '1.5px solid',
                      cursor:       'pointer',
                      fontWeight:   600,
                      fontSize:     14,
                      transition:   'all .2s',
                      borderColor:  actionForm.status === s
                        ? (s === 'Approved' ? '#1D9E75' : '#D85A30')
                        : '#e0e0e0',
                      background: actionForm.status === s
                        ? (s === 'Approved' ? '#E8F8F2' : '#FEE8E8')
                        : '#fafafa',
                      color: actionForm.status === s
                        ? (s === 'Approved' ? '#1D9E75' : '#D85A30')
                        : '#888',
                    }}
                  >
                    {s === 'Approved' ? '✓ Approve' : '✕ Reject'}
                  </button>
                ))}
              </div>

              {/* Comment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>
                  Comment{actionForm.status === 'Rejected' ? ' *' : ' (optional)'}
                </label>
                <textarea
                  value={actionForm.remarks}
                  onChange={e => setActionForm(p => ({ ...p, remarks: e.target.value }))}
                  placeholder={
                    actionForm.status === 'Rejected'
                      ? 'Explain why this is rejected...'
                      : 'Add an optional note...'
                  }
                  rows={3}
                  style={S.textarea}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...S.submitBtn,
                  background: actionForm.status === 'Approved' ? '#1D9E75' : '#D85A30',
                  opacity:    submitting ? 0.7 : 1,
                  cursor:     submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : `Confirm ${actionForm.status}`}
              </button>

            </form>
          </div>
        )}

        {/* ── Approval record (already decided) ── */}
        {expense.status !== 'Pending' && (
          <div style={S.approvalRecord}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: '#555' }}>
              Approval Record
            </h3>
            <div style={S.detailGrid}>
              <DetailRow
                label="Decision"
                value={expense.status}
                valueStyle={{ ...STATUS_STYLE[expense.status],
                              padding: '2px 8px', borderRadius: 6, fontSize: 12 }}
              />
              {expense.approval && (
                <>
                  <DetailRow
                    label="Actioned by"
                    value={expense.approval?.manager?.name || '—'}
                  />
                  <DetailRow
                    label="Comment"
                    value={expense.approval?.comment || '—'}
                  />
                  <DetailRow
                    label="Actioned at"
                    value={formatDate(expense.approval?.approved_at)}
                  />
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DetailRow({ label, value, bold, valueStyle }) {
  return (
    <div style={S.detailRow}>
      <span style={S.detailLabel}>{label}</span>
      <span style={{
        fontSize:   14,
        color:      '#1a1a1a',
        fontWeight: bold ? 700 : 400,
        textAlign:  'right',
        maxWidth:   '60%',
        ...valueStyle
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const spinnerStyle = {
  width:        32,
  height:       32,
  border:       '3px solid #EBF4FF',
  borderTop:    '3px solid #378ADD',
  borderRadius: '50%',
  animation:    'spin 0.8s linear infinite',
  margin:       '0 auto',
};

const S = {
  page:     { padding: '24px 28px', maxWidth: 720, margin: '0 auto',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  backBtn:  { background: 'none', border: 'none', color: '#378ADD', fontSize: 14,
              cursor: 'pointer', padding: '0 0 20px', display: 'block',
              fontWeight: 500 },
  card:     { background: '#fff', borderRadius: 16, padding: '28px 32px',
              boxShadow: '0 1px 12px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' },
  cardHeader:   { display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 24,
                  paddingBottom: 20, borderBottom: '1px solid #f5f5f5' },
  title:        { fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  sub:          { fontSize: 13, color: '#888', margin: '4px 0 0' },
  statusBadge:  { padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  flexShrink: 0 },
  section:      { marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f5f5f5' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase',
                  letterSpacing: '.05em', margin: '0 0 12px' },
  detailGrid:   { display: 'flex', flexDirection: 'column' },
  detailRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #f9f9f9' },
  detailLabel:  { fontSize: 13, color: '#888', fontWeight: 500 },
  personCard:   { display: 'flex', alignItems: 'center', gap: 12, background: '#f8f9fa',
                  borderRadius: 10, padding: '12px 14px' },
  avatar:       { width: 36, height: 36, borderRadius: '50%', background: '#EBF4FF',
                  color: '#378ADD', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  approvalSection: { background: '#f8f9fa', borderRadius: 12, padding: '20px',
                     marginTop: 8 },
  approvalRecord:  { background: '#f8f9fa', borderRadius: 12, padding: '20px',
                     marginTop: 16 },
  approvalForm: { display: 'flex', flexDirection: 'column', gap: 14 },
  textarea:     { padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8,
                  fontSize: 13, outline: 'none', resize: 'vertical',
                  background: '#fff', width: '100%', boxSizing: 'border-box',
                  fontFamily: 'inherit' },
  submitBtn:    { width: '100%', padding: '12px', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 600 },
};