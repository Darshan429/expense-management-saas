import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar         from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import Expenses       from './pages/Expenses';
// 1. Import your single expense details component here:
import NotFound       from './pages/NotFound';
import Budgets        from './pages/Budgets';
import Admin          from './pages/Admin';
import ExpenseDetails from './pages/ExpenseDetails';

const NO_NAV = ['/login', '/register'];

export default function App() {
  const location = useLocation();
  const showNav  = !NO_NAV.includes(location.pathname);
  return (
    <>
      {showNav && <Navbar />}
      <Routes>
        
        {/* Public routes — no auth needed */}
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* All roles */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/expenses" element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        } />

        <Route path="/expenses/:id" element={
          <ProtectedRoute>
              <ExpenseDetails />
          </ProtectedRoute>
        } />

        {/* 2. ADD THIS NEW ROUTE FOR SPECIFIC EXPENSE IDS */}
        <Route path="/expenses/:id" element={
          <ProtectedRoute>
            <ExpenseDetails />
          </ProtectedRoute>
        } />

        {/* Role-protected routes */}
        <Route path="/budgets" element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <Budgets />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute roles={['ADMIN']}>
          <Admin />
          </ProtectedRoute>
        } />

        {/* 3. MOVE THE 404 CATCH-ALL TO THE VERY BOTTOM */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </>
  );
}