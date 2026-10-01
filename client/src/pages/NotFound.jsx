import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const home = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MANAGER'
    ? '/dashboard'
    : '/expenses';

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '100vh',
      fontFamily:     '-apple-system, sans-serif',
      background:     '#f5f7fa',
      textAlign:      'center',
      padding:        24
    }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
        Page not found
      </h1>
      <p style={{ fontSize: 15, color: '#888', margin: '0 0 28px' }}>
        The page you're looking for doesn't exist or you don't have access to it.
      </p>
      <button
        onClick={() => navigate(user ? home : '/login')}
        style={{
          padding:      '10px 24px',
          background:   '#378ADD',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          fontSize:     14,
          fontWeight:   500,
          cursor:       'pointer'
        }}
      >
        {user ? 'Go to dashboard' : 'Go to login'}
      </button>
    </div>
  );
}