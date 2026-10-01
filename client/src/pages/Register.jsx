import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'];

export default function Register() {
  const [form, setForm] = useState({
    name:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
    role:            'EMPLOYEE',
    department_id:   '',
  });
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showPwd,     setShowPwd]     = useState(false);
  const [step,        setStep]        = useState(1);

  const { login, register } = useAuth();  // ← single declaration at top
  const navigate = useNavigate();

  const loadDepartments = async () => {
  try {
    const { data } = await api.get('/departments');
    console.log('Departments loaded:', data);  // ← add this
    setDepartments(data);
  } catch (err) {
    console.error('Failed to load departments:', err.response?.data);  // ← add this
    setDepartments([]);
  }
};

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error('Enter a valid email address');
      return;
    }
    loadDepartments();
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.password) {
      toast.error('Password is required');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if(form.role != 'ADMIN' && !form.department_id){
      toast.error('Please select a department');
      return;
    }

    setLoading(true);
    try {
      await register({
        name:          form.name,
        email:         form.email,
        password:      form.password,
        role:          form.role,
        department_id: form.department_id || null,
      });

      toast.success('Account created! Signing you in...');

      const user = await login(form.email, form.password);
      if (user.role === 'ADMIN')        navigate('/admin');
      else if (user.role === 'MANAGER') navigate('/dashboard');
      else                              navigate('/expenses');

    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      toast.error(msg);
      if (msg.toLowerCase().includes('email')) setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '#eee' };
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const levels = [
      { label: '',       color: '#eee'    },
      { label: 'Weak',   color: '#E24B4A' },
      { label: 'Fair',   color: '#BA7517' },
      { label: 'Good',   color: '#378ADD' },
      { label: 'Strong', color: '#1D9E75' },
    ];
    return { score, ...levels[score] };
  };

  const strength = getStrength(form.password);

  return (
    <div style={styles.page}>

      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logo}>💳</div>
          <h1 style={styles.brand}>ExpenseTracker</h1>
          <p style={styles.brandSub}>
            Join your team and start managing expenses smarter
          </p>

          <div style={styles.steps}>
            {['Your Info', 'Account Setup'].map((s, i) => (
              <div key={i} style={styles.stepRow}>
                <div style={{
                  ...styles.stepCircle,
                  background: step > i + 1 ? '#1D9E75'
                            : step === i + 1 ? '#fff'
                            : 'rgba(255,255,255,0.2)',
                  color:  step === i + 1 ? '#1a3a6e' : '#fff',
                  border: step === i + 1 ? '2px solid #fff' : 'none'
                }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span style={{
                  ...styles.stepLabel,
                  color: step === i + 1 ? '#fff' : 'rgba(255,255,255,0.5)'
                }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.card}>

          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              {step === 1 ? 'Create your account' : 'Set up your profile'}
            </h2>
            <p style={styles.cardSub}>
              Step {step} of 2 — {step === 1 ? 'Basic information' : 'Role and security'}
            </p>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <form onSubmit={handleNext} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Full name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Arjun Nair"
                  style={styles.input}
                  autoFocus
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Work email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  style={styles.input}
                />
              </div>
              <button type="submit" style={styles.submitBtn}>
                Continue →
              </button>
            </form>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={styles.form}>

              <div style={styles.field}>
                <label style={styles.label}>Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  style={styles.input}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span style={styles.hint}>
                  {form.role === 'ADMIN'
                    ? 'Full access — manage users, departments, budgets'
                    : form.role === 'MANAGER'
                    ? 'Approve/reject expenses for your department'
                    : 'Submit expenses and track approvals'}
                </span>
              </div>

              {departments.length > 0 && (
  <div style={styles.field}>
    <label style={styles.label}>
      Department {form.role !== 'ADMIN' ? '*' : '(optional)'}
    </label>
    <select
      name="department_id"
      value={form.department_id}
      onChange={handleChange}
      style={{
        ...styles.input,
        borderColor: form.role !== 'ADMIN' && !form.department_id
          ? '#e0e0e0'
          : '#e0e0e0'
      }}
    >
      <option value="">
        {form.role !== 'ADMIN' ? 'Select department' : 'Select department (optional)'}
      </option>
      {departments.map(d => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
    {form.role !== 'ADMIN' && (
      <span style={styles.hint}>
        Required for submitting and approving expenses
      </span>
    )}
  </div>
)}

              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <div style={styles.inputWrapper}>
                  <input
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min 8 characters"
                    style={{ ...styles.input, paddingRight: 44 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    style={styles.eyeBtn}
                  >
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.password && (
                  <div style={{ marginTop: 6 }}>
                    <div style={styles.strengthTrack}>
                      <div style={{
                        ...styles.strengthFill,
                        width:      `${(strength.score / 4) * 100}%`,
                        background: strength.color
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: strength.color, fontWeight: 500 }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm password</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  style={{
                    ...styles.input,
                    borderColor: form.confirmPassword && form.confirmPassword !== form.password
                      ? '#E24B4A'
                      : form.confirmPassword && form.confirmPassword === form.password
                      ? '#1D9E75'
                      : '#e0e0e0'
                  }}
                />
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <span style={{ fontSize: 11, color: '#E24B4A' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={styles.backBtn}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.submitBtn,
                    flex:    1,
                    opacity: loading ? 0.7 : 1,
                    cursor:  loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>

            </form>
          )}

          <div style={styles.footer}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>Sign in</Link>
          </div>

        </div>
      </div>
    </div>
  );
}

const styles = {
  page:        { display: 'flex', minHeight: '100vh',
                 fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  left:        { flex: 1, background: 'linear-gradient(135deg, #1a3a6e 0%, #378ADD 100%)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 },
  leftInner:   { maxWidth: 340 },
  logo:        { fontSize: 48, marginBottom: 12 },
  brand:       { fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  brandSub:    { fontSize: 14, color: '#BDD7FF', marginBottom: 40, lineHeight: 1.5 },
  steps:       { display: 'flex', flexDirection: 'column', gap: 16 },
  stepRow:     { display: 'flex', alignItems: 'center', gap: 12 },
  stepCircle:  { width: 28, height: 28, borderRadius: '50%', display: 'flex',
                 alignItems: 'center', justifyContent: 'center',
                 fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all .2s' },
  stepLabel:   { fontSize: 13, transition: 'color .2s' },
  right:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 background: '#f5f7fa', padding: 24 },
  card:        { background: '#fff', borderRadius: 16, padding: '40px 36px',
                 width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  cardHeader:  { marginBottom: 28 },
  cardTitle:   { fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px' },
  cardSub:     { fontSize: 14, color: '#888', margin: 0 },
  form:        { display: 'flex', flexDirection: 'column', gap: 18 },
  field:       { display: 'flex', flexDirection: 'column', gap: 6 },
  label:       { fontSize: 13, fontWeight: 500, color: '#444' },
  hint:        { fontSize: 11, color: '#888', lineHeight: 1.4 },
  inputWrapper:{ position: 'relative' },
  input:       { width: '100%', padding: '10px 14px', border: '1.5px solid #e0e0e0',
                 borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                 color: '#1a1a1a', background: '#fafafa', transition: 'border-color .2s' },
  eyeBtn:      { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                 background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 },
  strengthTrack: { height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  strengthFill:  { height: '100%', borderRadius: 2, transition: 'width .3s, background .3s' },
  submitBtn:   { width: '100%', padding: '12px', background: '#378ADD', color: '#fff',
                 border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                 cursor: 'pointer', transition: 'background .2s' },
  backBtn:     { padding: '12px 20px', background: '#f0f0f0', color: '#555',
                 border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  footer:      { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 20 },
  link:        { color: '#378ADD', fontWeight: 500, textDecoration: 'none' },
};