import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { path: '/expenses',  label: 'Expenses',  icon: '💳', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { path: '/budgets',   label: 'Budgets',   icon: '💰', roles: ['ADMIN', 'MANAGER'] },
  { path: '/admin',     label: 'Admin',     icon: '⚙️',  roles: ['ADMIN'] },
];

export default function Navbar() {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [notifications,  setNotifications]  = useState([]);
  const [unreadCount,    setUnreadCount]     = useState(0);
  const [bellOpen,       setBellOpen]        = useState(false);
  const [profileOpen,    setProfileOpen]     = useState(false);
  const [mobileOpen,     setMobileOpen]      = useState(false);

  const bellRef    = useRef(null);
  const profileRef = useRef(null);

  // ── Fetch notifications on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current    && !bellRef.current.contains(e.target))    setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Close mobile menu on route change ────────────────────────────────────
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch { /* silent */ }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markOneRead(notif.id);
    setBellOpen(false);
    if (notif.expense_id) navigate(`/expenses/${notif.expense_id}`);
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const TYPE_ICON = {
    EXPENSE_APPROVED:  { icon: '✓', bg: '#E8F8F2', color: '#1D9E75' },
    EXPENSE_REJECTED:  { icon: '✕', bg: '#FEE8E8', color: '#D85A30' },
    BUDGET_ALERT:      { icon: '⚠', bg: '#FEF3E2', color: '#BA7517' },
    EXPENSE_SUBMITTED: { icon: '↑', bg: '#EBF4FF', color: '#378ADD' },
  };

  // Visible nav links based on role
  const visibleLinks = NAV_LINKS.filter(link =>
    link.roles.includes(user?.role)
  );

  const isActive = (path) => location.pathname === path;

  if (!user) return null;

  return (
    <>
      <nav style={S.nav}>
        <div style={S.inner}>

          {/* ── Logo ── */}
          <Link to={isAdmin ? '/admin' : isManager ? '/dashboard' : '/expenses'}
                style={S.logo}>
            <span style={S.logoIcon}>💳</span>
            <span style={S.logoText}>ExpenseTracker</span>
          </Link>

          {/* ── Desktop Nav Links ── */}
          <div style={S.links}>
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  ...S.link,
                  background:  isActive(link.path) ? '#EBF4FF' : 'transparent',
                  color:       isActive(link.path) ? '#378ADD'  : '#555',
                  fontWeight:  isActive(link.path) ? 600        : 400,
                }}
              >
                <span style={{ fontSize: 15 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right side — Bell + Profile ── */}
          <div style={S.right}>

            {/* Notification Bell */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setBellOpen(o => !o);
                  setProfileOpen(false);
                  if (!bellOpen) fetchNotifications();
                }}
                style={S.iconBtn}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={S.badge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Bell Dropdown */}
              {bellOpen && (
                <div style={S.dropdown}>
                  <div style={S.dropHeader}>
                    <span style={S.dropTitle}>
                      Notifications
                      {unreadCount > 0 && (
                        <span style={S.unreadBadge}>{unreadCount} new</span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={S.markReadBtn}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={S.notifList}>
                    {notifications.length === 0 ? (
                      <div style={S.notifEmpty}>
                        <span style={{ fontSize: 28 }}>🔕</span>
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#aaa' }}>
                          No notifications yet
                        </p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map(n => {
                        const cfg = TYPE_ICON[n.type] || TYPE_ICON.EXPENSE_SUBMITTED;
                        return (
                          <div
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            style={{
                              ...S.notifItem,
                              background: n.is_read ? 'transparent' : '#F0F7FF',
                              cursor: n.expense_id ? 'pointer' : 'default'
                            }}
                          >
                            <div style={{
                              ...S.notifIcon,
                              background: cfg.bg,
                              color:      cfg.color
                            }}>
                              {cfg.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={S.notifTitle}>{n.title}</div>
                              <div style={S.notifMsg}>{n.message}</div>
                              <div style={S.notifTime}>{timeAgo(n.created_at)}</div>
                            </div>
                            {!n.is_read && <div style={S.unreadDot} />}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div style={S.dropFooter}>
                      <button
                        onClick={() => { setBellOpen(false); navigate('/expenses'); }}
                        style={S.viewAllBtn}
                      >
                        View all expenses →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setProfileOpen(o => !o);
                  setBellOpen(false);
                }}
                style={S.profileBtn}
              >
                <div style={S.avatar}>
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={S.profileInfo}>
                  <span style={S.profileName}>{user.name}</span>
                  <span style={S.profileRole}>{user.role}</span>
                </div>
                <span style={{ color: '#aaa', fontSize: 12 }}>▾</span>
              </button>

              {profileOpen && (
                <div style={{ ...S.dropdown, right: 0, width: 200 }}>
                  <div style={S.profileHeader}>
                    <div style={{ ...S.avatar, width: 40, height: 40, fontSize: 16 }}>
                      {user.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>{user.email}</div>
                    </div>
                  </div>

                  <div style={S.profileDivider} />

                  <div style={{ padding: '4px 0' }}>
                    <span style={{
                      display:      'block',
                      padding:      '6px 16px',
                      fontSize:     11,
                      fontWeight:   600,
                      color:        '#aaa',
                      textTransform:'uppercase',
                      letterSpacing:'.05em'
                    }}>
                      {user.role}
                    </span>

                    {visibleLinks.map(link => (
                      <button
                        key={link.path}
                        onClick={() => { navigate(link.path); setProfileOpen(false); }}
                        style={{
                          ...S.menuItem,
                          background: isActive(link.path) ? '#EBF4FF' : 'transparent',
                          color:      isActive(link.path) ? '#378ADD'  : '#444',
                        }}
                      >
                        <span>{link.icon}</span>
                        {link.label}
                      </button>
                    ))}
                  </div>

                  <div style={S.profileDivider} />

                  <button onClick={handleLogout} style={{ ...S.menuItem, color: '#D85A30' }}>
                    <span>🚪</span> Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{ ...S.iconBtn, display: 'none', ...S.hamburger }}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {mobileOpen && (
          <div style={S.mobileMenu}>
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  ...S.mobileLink,
                  background: isActive(link.path) ? '#EBF4FF' : 'transparent',
                  color:      isActive(link.path) ? '#378ADD'  : '#444',
                }}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <button onClick={handleLogout} style={S.mobileLogout}>
              🚪 Sign out
            </button>
          </div>
        )}
      </nav>

      {/* Spacer so page content doesn't hide behind fixed navbar */}
      <div style={{ height: 60 }} />
    </>
  );
}

const S = {
  nav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                background: '#fff', borderBottom: '1px solid #f0f0f0',
                boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  inner:      { maxWidth: 1200, margin: '0 auto', padding: '0 24px',
                height: 60, display: 'flex', alignItems: 'center', gap: 32 },
  logo:       { display: 'flex', alignItems: 'center', gap: 8,
                textDecoration: 'none', flexShrink: 0 },
  logoIcon:   { fontSize: 22 },
  logoText:   { fontSize: 16, fontWeight: 700, color: '#1a3a6e' },
  links:      { display: 'flex', alignItems: 'center', gap: 4, flex: 1 },
  link:       { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 8, fontSize: 13, textDecoration: 'none',
                transition: 'all .15s', whiteSpace: 'nowrap' },
  right:      { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  iconBtn:    { position: 'relative', background: 'none', border: 'none',
                cursor: 'pointer', padding: 8, fontSize: 18, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s' },
  badge:      { position: 'absolute', top: 2, right: 2, background: '#E24B4A',
                color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                width: 16, height: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  profileBtn: { display: 'flex', alignItems: 'center', gap: 8, background: 'none',
                border: '1px solid #f0f0f0', borderRadius: 10, padding: '5px 10px',
                cursor: 'pointer', transition: 'background .15s' },
  avatar:     { width: 30, height: 30, borderRadius: '50%', background: '#EBF4FF',
                color: '#378ADD', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  profileInfo:{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  profileName:{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' },
  profileRole:{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em' },
  dropdown:   { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320,
                background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' },
  dropHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid #f5f5f5' },
  dropTitle:  { fontSize: 13, fontWeight: 600, color: '#1a1a1a',
                display: 'flex', alignItems: 'center', gap: 8 },
  unreadBadge:{ background: '#E24B4A', color: '#fff', fontSize: 10, fontWeight: 600,
                padding: '1px 6px', borderRadius: 8 },
  markReadBtn:{ background: 'none', border: 'none', color: '#378ADD', fontSize: 12,
                cursor: 'pointer', fontWeight: 500 },
  notifList:  { maxHeight: 340, overflowY: 'auto' },
  notifEmpty: { padding: '32px 16px', textAlign: 'center' },
  notifItem:  { display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'flex-start',
                borderBottom: '1px solid #f9f9f9', transition: 'background .15s' },
  notifIcon:  { width: 30, height: 30, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0 },
  notifTitle: { fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 },
  notifMsg:   { fontSize: 12, color: '#666', lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  notifTime:  { fontSize: 11, color: '#aaa', marginTop: 4 },
  unreadDot:  { width: 8, height: 8, borderRadius: '50%', background: '#378ADD',
                flexShrink: 0, marginTop: 4 },
  dropFooter: { padding: '10px 14px', borderTop: '1px solid #f5f5f5' },
  viewAllBtn: { width: '100%', background: 'none', border: 'none', color: '#378ADD',
                fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'center' },
  profileHeader:{ display: 'flex', gap: 10, padding: '14px 16px',
                  alignItems: 'center', borderBottom: '1px solid #f5f5f5' },
  profileDivider:{ height: 1, background: '#f5f5f5', margin: '4px 0' },
  menuItem:   { display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 16px', background: 'none', border: 'none',
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s' },
  mobileMenu: { borderTop: '1px solid #f0f0f0', padding: '8px 16px 16px',
                display: 'flex', flexDirection: 'column', gap: 2 },
  mobileLink: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  mobileLogout:{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                 borderRadius: 8, border: 'none', background: 'none', fontSize: 14,
                 color: '#D85A30', cursor: 'pointer', width: '100%', textAlign: 'left',
                 marginTop: 8, fontWeight: 500 },
  hamburger:  { fontSize: 20 },
};