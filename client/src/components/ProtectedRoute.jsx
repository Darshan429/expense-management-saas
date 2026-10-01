import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Still checking localStorage / verifying token — show nothing yet
  if (loading) {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100vh',
        fontFamily:     '-apple-system, sans-serif',
        background:     '#f5f7fa',
        gap:            16
      }}>
        <div style={spinnerStyle} />
        <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
          Loading...
        </p>
      </div>
    );
  }

  // Not logged in — redirect to login, remember where they were trying to go
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Logged in but wrong role — redirect to their home page
  if (roles && !roles.includes(user.role)) {
    const home = user.role === 'ADMIN'
      ? '/admin'
      : user.role === 'MANAGER'
      ? '/dashboard'
      : '/expenses';

    return <Navigate to={home} replace />;
  }

  // All checks passed — render the page
  return children;
}

const spinnerStyle = {
  width:           36,
  height:          36,
  border:          '3px solid #EBF4FF',
  borderTop:       '3px solid #378ADD',
  borderRadius:    '50%',
  animation:       'spin 0.8s linear infinite',
};