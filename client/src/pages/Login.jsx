import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

export default function Login() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();


  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back , ${user.name}!`);

      const from = location.state?.from;
      if (from)                          navigate(from);
      else if (user.role === 'ADMIN')    navigate('/admin');
      else if (user.role === 'MANAGER')  navigate('/dashboard');
      else                               navigate('/expenses');

    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>

      {/* Left panel — branding */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logo}>💳</div>
          <h1 style={styles.brand}>ExpenseTracker</h1>
          <p style={styles.brandSub}>
            Smart expense management for modern teams
          </p>

          <div style={styles.featureList}>
            {[
              { icon: '✓', text: 'AI-powered receipt scanning' },
              { icon: '✓', text: 'Real-time approval notifications' },
              { icon: '✓', text: 'Analytics dashboard' },
              { icon: '✓', text: 'Multi-role access control' },
            ].map((f, i) => (
              <div key={i} style={styles.feature}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={styles.right}>
        <div style={styles.card}>

          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Welcome back</h2>
            <p style={styles.cardSub}>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>

            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                style={styles.input}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
              </div>
              <div style={styles.inputWrapper}>
                <input
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  style={{ ...styles.input, paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  style={styles.eyeBtn}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.7 : 1,
                cursor:  loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

          </form>

          <div style={styles.footer}>
            Don't have an account?{' '}
            <Link to="/register" style={styles.link}>Create one</Link>
          </div>

          {/* Quick test credentials for demo */}
          <div style={styles.demoBox}>
            <p style={styles.demoTitle}>Demo credentials</p>
            {[
              { role: 'Admin',    email: 'priya@test.com' },
              { role: 'Manager',  email: 'rahul@test.com' },
              { role: 'Employee', email: 'arjun@test.com' },
            ].map(d => (
              <button
                key={d.role}
                type="button"
                onClick={() => setForm({ email: d.email, password: 'Test@1234' })}
                style={styles.demoBtn}
              >
                {d.role}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display:       'flex',
    minHeight:     '100vh',
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  left: {
    flex:            1,
    background:      'linear-gradient(135deg, #1a3a6e 0%, #378ADD 100%)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         48,
  },
  leftInner: { maxWidth: 380 },
  logo:  { fontSize: 48, marginBottom: 12 },
  brand: { fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  brandSub: { fontSize: 15, color: '#BDD7FF', marginBottom: 40, lineHeight: 1.5 },
  featureList: { display: 'flex', flexDirection: 'column', gap: 14 },
  feature:    { display: 'flex', alignItems: 'center', gap: 12 },
  featureIcon:{ width: 22, height: 22, background: '#1D9E75', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 },
  featureText:{ fontSize: 14, color: '#BDD7FF' },
  right: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     '#f5f7fa',
    padding:        24,
  },
  card: {
    background:   '#fff',
    borderRadius: 16,
    padding:      '40px 36px',
    width:        '100%',
    maxWidth:     420,
    boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
  },
  cardHeader: { marginBottom: 28 },
  cardTitle:  { fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px' },
  cardSub:    { fontSize: 14, color: '#888', margin: 0 },
  form:       { display: 'flex', flexDirection: 'column', gap: 18 },
  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 13, fontWeight: 500, color: '#444' },
  labelRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  inputWrapper: { position: 'relative' },
  input: {
    width:        '100%',
    padding:      '10px 14px',
    border:       '1.5px solid #e0e0e0',
    borderRadius: 8,
    fontSize:     14,
    outline:      'none',
    transition:   'border-color .2s',
    boxSizing:    'border-box',
    color:        '#1a1a1a',
    background:   '#fafafa',
  },
  eyeBtn: {
    position:   'absolute',
    right:      12,
    top:        '50%',
    transform:  'translateY(-50%)',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    fontSize:   16,
    padding:    0,
  },
  submitBtn: {
    width:        '100%',
    padding:      '12px',
    background:   '#378ADD',
    color:        '#fff',
    border:       'none',
    borderRadius: 8,
    fontSize:     15,
    fontWeight:   600,
    marginTop:    4,
    transition:   'background .2s',
  },
  footer: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 20 },
  link:   { color: '#378ADD', fontWeight: 500, textDecoration: 'none' },
  demoBox: {
    marginTop:    20,
    padding:      '12px 14px',
    background:   '#f5f7fa',
    borderRadius: 8,
    border:       '1px dashed #ddd',
  },
  demoTitle: { fontSize: 11, color: '#aaa', textTransform: 'uppercase',
               letterSpacing: '.05em', margin: '0 0 8px', fontWeight: 500 },
  demoBtn: {
    marginRight:  6,
    padding:      '4px 10px',
    fontSize:     12,
    borderRadius: 6,
    border:       '1px solid #ddd',
    background:   '#fff',
    cursor:       'pointer',
    color:        '#555',
  },
};