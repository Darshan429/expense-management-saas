import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

const ROLE_STYLE = {
  ADMIN:    { background: '#EDE9FF', color: '#534AB7' },
  MANAGER:  { background: '#EBF4FF', color: '#378ADD' },
  EMPLOYEE: { background: '#E8F8F2', color: '#1D9E75' },
};

const STATUS_STYLE = {
  true:  { background: '#E8F8F2', color: '#1D9E75', label: 'Active'   },
  false: { background: '#FEE8E8', color: '#D85A30', label: 'Inactive' },
};

export default function Admin() {
  const { user: currentUser } = useAuth();

  const [activeTab,   setActiveTab]   = useState('users');
  const [users,       setUsers]       = useState([]);
  const [departments, setDepartments] = useState([]);
  const [overview,    setOverview]    = useState(null);
  const [auditLog,    setAuditLog]    = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Filters
  const [searchUser,    setSearchUser]    = useState('');
  const [filterRole,    setFilterRole]    = useState('');
  const [filterActive,  setFilterActive]  = useState('');

  // Modals
  const [editUser,    setEditUser]    = useState(null);
  const [editDept,    setEditDept]    = useState(null);
  const [showDeptForm,setShowDeptForm]= useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // Forms
  const [userForm,  setUserForm]  = useState({ role: '', department_id: '', manager_id: '' });
  const [deptForm,  setDeptForm]  = useState({ name: '', description: '' });

  // Audit pagination
  const [auditPage,  setAuditPage]  = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  useEffect(() => {
    fetchOverview();
    if (activeTab === 'users')       fetchUsers();
    if (activeTab === 'departments') fetchDepartments();
    if (activeTab === 'audit')       fetchAuditLog(1);
  }, [activeTab]);

  // ── Fetch functions ───────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole)   params.append('role',      filterRole);
      if (filterActive) params.append('is_active',  filterActive);
      if (searchUser)   params.append('search',     searchUser);
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data);
    } catch { toast.error('Failed to load users'); }
    finally  { setLoading(false); }
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/departments');
      setDepartments(data);
    } catch { toast.error('Failed to load departments'); }
    finally  { setLoading(false); }
  };

  const fetchOverview = async () => {
    try {
      const { data } = await api.get('/admin/overview');
      setOverview(data);
    } catch { /* silent */ }
  };

  const fetchAuditLog = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/audit-log?page=${page}&limit=15`);
      setAuditLog(data.logs);
      setAuditTotal(data.pagination.total);
      setAuditPage(page);
    } catch { toast.error('Failed to load audit log'); }
    finally  { setLoading(false); }
  };

  // ── User actions ──────────────────────────────────────────────────────────
  const openEditUser = (user) => {
    setEditUser(user);
    setUserForm({
      role:          user.role,
      department_id: user.department_id  || '',
      manager_id:    user.manager_id     || '',
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const promises = [];

      if (userForm.role !== editUser.role) {
        promises.push(api.patch(`/admin/users/${editUser.id}/role`,
          { role: userForm.role }));
      }
      if (String(userForm.department_id) !== String(editUser.department_id || '')) {
        promises.push(api.patch(`/admin/users/${editUser.id}/department`,
          { department_id: userForm.department_id || null }));
      }
      if (String(userForm.manager_id) !== String(editUser.manager_id || '')) {
        promises.push(api.patch(`/admin/users/${editUser.id}/manager`,
          { manager_id: userForm.manager_id || null }));
      }

      if (promises.length === 0) {
        toast('No changes made');
        setEditUser(null);
        return;
      }

      await Promise.all(promises);
      toast.success('User updated successfully');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (user.id === currentUser.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    try {
      await api.patch(`/admin/users/${user.id}/${action}`,{});
      toast.success(`${user.name} ${action}d`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`${user.name} deleted`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // ── Department actions ────────────────────────────────────────────────────
  const openEditDept = (dept) => {
    setEditDept(dept);
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setShowDeptForm(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!deptForm.name) { toast.error('Department name is required'); return; }

    setSubmitting(true);
    try {
      if (editDept) {
        await api.patch(`/admin/departments/${editDept.id}`, deptForm);
        toast.success('Department updated');
      } else {
        await api.post('/admin/departments', deptForm);
        toast.success('Department created');
      }
      setShowDeptForm(false);
      setEditDept(null);
      setDeptForm({ name: '', description: '' });
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!window.confirm(
      `Delete "${dept.name}"? This fails if members are still assigned.`
    )) return;
    try {
      await api.delete(`/admin/departments/${dept.id}`);
      toast.success(`${dept.name} deleted`);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    if (!searchUser) return true;
    const q = searchUser.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const fmt = (n) => `Rs.${parseFloat(n || 0).toLocaleString('en-IN')}`;

  return (
    <div style={S.page}>

      {/* ── Page Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Admin Panel</h1>
          <p style={S.sub}>Manage users, departments and system settings</p>
        </div>
      </div>

      {/* ── System Overview Cards ── */}
      {overview && (
        <div style={S.overviewGrid}>
          {[
            { label: 'Total Users',    value: overview.users?.total_users,    icon: '👥', color: '#378ADD' },
            { label: 'Active Employees',value: overview.users?.employee_count, icon: '💼', color: '#1D9E75' },
            { label: 'Pending Expenses',value: overview.expenses?.pending,     icon: '⏳', color: '#BA7517' },
            { label: 'This Month Spend',value: fmt(overview.expenses?.approved_spend), icon: '💰', color: '#534AB7' },
          ].map((k, i) => (
            <div key={i} style={{ ...S.overviewCard, borderTop: `4px solid ${k.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={S.overviewLabel}>{k.label}</div>
                  <div style={{ ...S.overviewVal, color: k.color }}>{k.value ?? '—'}</div>
                </div>
                <span style={{ fontSize: 28 }}>{k.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={S.tabRow}>
        {[
          { key: 'users',       label: '👥 Users'       },
          { key: 'departments', label: '🏢 Departments' },
          { key: 'audit',       label: '📋 Audit Log'   },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...S.tab,
              color:        activeTab === tab.key ? '#378ADD' : '#888',
              fontWeight:   activeTab === tab.key ? 600 : 400,
              borderBottom: activeTab === tab.key
                ? '2px solid #378ADD' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          USERS TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div style={S.tabContent}>

          {/* Filters */}
          <div style={S.filterRow}>
            <input
              placeholder="Search by name or email..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              style={S.searchInput}
            />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={S.select}>
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterActive} onChange={e => setFilterActive(e.target.value)} style={S.select}>
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button onClick={fetchUsers} style={S.filterBtn}>Search</button>
          </div>

          {/* User count */}
          <div style={S.countRow}>
            <span style={{ fontSize: 13, color: '#888' }}>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Users table */}
          {loading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState icon="👥" message="No users found" />
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['User', 'Role', 'Department', 'Manager', 'Status', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id} style={{
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                      opacity: u.is_active ? 1 : 0.6
                    }}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            ...S.avatar,
                            background: u.is_active ? '#EBF4FF' : '#f0f0f0',
                            color:      u.is_active ? '#378ADD'  : '#aaa',
                          }}>
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                              {u.name}
                              {u.id === currentUser.id && (
                                <span style={S.youBadge}> you</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, ...ROLE_STYLE[u.role] }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: '#555', fontSize: 13 }}>
                        {u.department?.name || '—'}
                      </td>
                      <td style={{ ...S.td, color: '#555', fontSize: 13 }}>
                        {u.manager?.name || '—'}
                      </td>
                      <td style={S.td}>
                        <span style={{
                          ...S.badge,
                          ...STATUS_STYLE[String(u.is_active)]
                        }}>
                          {STATUS_STYLE[String(u.is_active)].label}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEditUser(u)}
                            style={S.actionBtn}
                            title="Edit user"
                          >
                            ✏️
                          </button>
                          {/* Toggle active */}
                          {u.id !== currentUser.id && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              style={{
                                ...S.actionBtn,
                                background: u.is_active ? '#FEE8E8' : '#E8F8F2',
                                color:      u.is_active ? '#D85A30' : '#1D9E75',
                              }}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {u.is_active ? '⏸' : '▶'}
                            </button>
                          )}
                          {/* Delete */}
                          {u.id !== currentUser.id && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              style={{ ...S.actionBtn, background: '#FEE8E8', color: '#D85A30' }}
                              title="Delete user"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          DEPARTMENTS TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'departments' && (
        <div style={S.tabContent}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => { setEditDept(null); setDeptForm({ name:'', description:'' }); setShowDeptForm(true); }}
              style={S.primaryBtn}
            >
              + New Department
            </button>
          </div>

          {loading ? (
            <div style={S.deptGrid}>
              {[1,2,3].map(i => <DeptSkeleton key={i} />)}
            </div>
          ) : departments.length === 0 ? (
            <EmptyState icon="🏢" message="No departments yet" />
          ) : (
            <div style={S.deptGrid}>
              {departments.map(dept => (
                <div key={dept.id} style={S.deptCard}>
                  <div style={S.deptCardHeader}>
                    <div>
                      <div style={S.deptName}>{dept.name}</div>
                      <div style={S.deptDesc}>{dept.description || 'No description'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditDept(dept)} style={S.actionBtn} title="Edit">✏️</button>
                      <button
                        onClick={() => handleDeleteDept(dept)}
                        style={{ ...S.actionBtn, background: '#FEE8E8', color: '#D85A30' }}
                        title="Delete"
                      >🗑</button>
                    </div>
                  </div>

                  <div style={S.deptStats}>
                    <div style={S.deptStat}>
                      <span style={S.deptStatVal}>{dept.member_count || 0}</span>
                      <span style={S.deptStatLabel}>Members</span>
                    </div>
                    <div style={S.deptStatDivider} />
                    <div style={S.deptStat}>
                      <span style={S.deptStatVal}>{dept.total_expenses || 0}</span>
                      <span style={S.deptStatLabel}>Expenses</span>
                    </div>
                    <div style={S.deptStatDivider} />
                    <div style={S.deptStat}>
                      <span style={{ ...S.deptStatVal, color: '#378ADD' }}>
                        {parseFloat(dept.burn_pct || 0).toFixed(0)}%
                      </span>
                      <span style={S.deptStatLabel}>Budget used</span>
                    </div>
                  </div>

                  {/* Budget burn bar */}
                  {parseFloat(dept.budget_allocated) > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                                    fontSize: 11, color: '#888', marginBottom: 6 }}>
                        <span>Budget</span>
                        <span>
                          Rs.{parseFloat(dept.budget_allocated || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ ...S.burnTrack }}>
                        <div style={{
                          ...S.burnFill,
                          width: `${Math.min(parseFloat(dept.burn_pct || 0), 100)}%`,
                          background: parseFloat(dept.burn_pct) >= 100 ? '#D85A30'
                                    : parseFloat(dept.burn_pct) >= 80  ? '#BA7517'
                                    : '#1D9E75'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          AUDIT LOG TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={S.tabContent}>
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : auditLog.length === 0 ? (
            <EmptyState icon="📋" message="No audit entries yet" />
          ) : (
            <>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['When', 'Actor', 'Action', 'Entity', 'Changes'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((log, i) => {
                      const ACTION_STYLE = {
                        CREATED:  { background: '#E8F8F2', color: '#1D9E75' },
                        UPDATED:  { background: '#EBF4FF', color: '#378ADD' },
                        APPROVED: { background: '#E8F8F2', color: '#1D9E75' },
                        REJECTED: { background: '#FEE8E8', color: '#D85A30' },
                        DELETED:  { background: '#FEE8E8', color: '#D85A30' },
                        LOGIN:    { background: '#EDE9FF', color: '#534AB7' },
                      };
                      return (
                        <tr key={log.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td style={S.td}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
                              {log.actor_name || 'System'}
                            </div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>{log.actor_role}</div>
                          </td>
                          <td style={S.td}>
                            <span style={{
                              ...S.badge,
                              ...(ACTION_STYLE[log.action] || { background: '#f0f0f0', color: '#888' })
                            }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={S.td}>
                            <div style={{ fontSize: 13, color: '#555' }}>{log.entity_type}</div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>ID: {log.entity_id}</div>
                          </td>
                          <td style={{ ...S.td, maxWidth: 200 }}>
                            {log.new_values ? (
                              <div style={S.changeWrap}>
                                {Object.entries(
                                  typeof log.new_values === 'string'
                                    ? JSON.parse(log.new_values)
                                    : log.new_values
                                ).map(([k, v]) => (
                                  <span key={k} style={S.changeChip}>
                                    {k}: {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={S.pagination}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {auditTotal} total entries
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => fetchAuditLog(auditPage - 1)}
                    disabled={auditPage === 1}
                    style={{ ...S.pageBtn, opacity: auditPage === 1 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>
                  <span style={S.pageInfo}>Page {auditPage}</span>
                  <button
                    onClick={() => fetchAuditLog(auditPage + 1)}
                    disabled={auditPage * 15 >= auditTotal}
                    style={{ ...S.pageBtn, opacity: auditPage * 15 >= auditTotal ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          EDIT USER MODAL
      ══════════════════════════════════════════ */}
      {editUser && (
        <Modal onClose={() => setEditUser(null)}>
          <h2 style={S.modalTitle}>Edit User</h2>

          <div style={S.userSummary}>
            <div style={{ ...S.avatar, width: 44, height: 44, fontSize: 18 }}>
              {editUser.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                {editUser.name}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>{editUser.email}</div>
            </div>
          </div>

          <form onSubmit={handleSaveUser} style={S.modalForm}>
            <div style={S.field}>
              <label style={S.label}>Role</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                style={S.input}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Department</label>
              <select
                value={userForm.department_id}
                onChange={e => setUserForm(p => ({ ...p, department_id: e.target.value }))}
                style={S.input}
              >
                <option value="">No department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Manager</label>
              <select
                value={userForm.manager_id}
                onChange={e => setUserForm(p => ({ ...p, manager_id: e.target.value }))}
                style={S.input}
              >
                <option value="">No manager</option>
                {users
                  .filter(u => u.id !== editUser.id && ['ADMIN','MANAGER'].includes(u.role))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))
                }
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setEditUser(null)} style={S.cancelBtn}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════
          DEPARTMENT FORM MODAL
      ══════════════════════════════════════════ */}
      {showDeptForm && (
        <Modal onClose={() => { setShowDeptForm(false); setEditDept(null); }}>
          <h2 style={S.modalTitle}>
            {editDept ? 'Edit Department' : 'New Department'}
          </h2>
          <form onSubmit={handleSaveDept} style={S.modalForm}>
            <div style={S.field}>
              <label style={S.label}>Department Name *</label>
              <input
                value={deptForm.name}
                onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Engineering"
                style={S.input}
                autoFocus
              />
            </div>
            <div style={S.field}>
              <label style={S.label}>Description</label>
              <textarea
                value={deptForm.description}
                onChange={e => setDeptForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What does this department do?"
                rows={3}
                style={{ ...S.input, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setShowDeptForm(false); setEditDept(null); }}
                style={S.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Saving...' : editDept ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={S.closeBtn}>✕</button>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}

function SkeletonTable({ rows, cols }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px',
                               background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} style={{ flex: 1, height: 14, background: '#f0f0f0', borderRadius: 6 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DeptSkeleton() {
  return (
    <div style={{ ...S.deptCard, pointerEvents: 'none' }}>
      <div style={{ width: 120, height: 16, background: '#f0f0f0', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ width: '80%', height: 12, background: '#f0f0f0', borderRadius: 6, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 36, background: '#f0f0f0', borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:         { padding: '24px 28px', maxWidth: 1200, margin: '0 auto',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  header:       { marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  sub:          { fontSize: 13, color: '#888', margin: '4px 0 0' },
  overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
  overviewCard: { background: '#fff', borderRadius: 12, padding: '16px 18px',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  overviewLabel:{ fontSize: 11, color: '#888', textTransform: 'uppercase',
                  letterSpacing: '.04em', marginBottom: 6 },
  overviewVal:  { fontSize: 26, fontWeight: 700 },
  tabRow:       { display: 'flex', borderBottom: '1px solid #eee', marginBottom: 20 },
  tab:          { padding: '10px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 14, transition: 'all .2s' },
  tabContent:   { },
  filterRow:    { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  searchInput:  { flex: 1, minWidth: 200, padding: '8px 14px', border: '1.5px solid #e0e0e0',
                  borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa' },
  select:       { padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8,
                  fontSize: 13, background: '#fafafa', outline: 'none', cursor: 'pointer' },
  filterBtn:    { padding: '8px 16px', background: '#378ADD', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  countRow:     { fontSize: 13, color: '#888', marginBottom: 10 },
  tableWrap:    { overflowX: 'auto', borderRadius: 12, border: '1px solid #f0f0f0' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead:        { background: '#f8f9fa' },
  th:           { padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
                  borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' },
  td:           { padding: '12px 14px', borderBottom: '1px solid #f9f9f9', verticalAlign: 'middle' },
  avatar:       { width: 32, height: 32, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0 },
  youBadge:     { fontSize: 10, background: '#EDE9FF', color: '#534AB7',
                  padding: '1px 5px', borderRadius: 4, fontWeight: 500 },
  badge:        { padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  display: 'inline-block' },
  actionBtn:    { width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#f5f5f5', color: '#555', fontSize: 13, display: 'flex',
                  alignItems: 'center', justifyContent: 'center' },
  deptGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 16 },
  deptCard:     { background: '#fff', borderRadius: 12, padding: '18px',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' },
  deptCardHeader:{ display: 'flex', justifyContent: 'space-between',
                   alignItems: 'flex-start', marginBottom: 16 },
  deptName:     { fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 },
  deptDesc:     { fontSize: 12, color: '#888' },
  deptStats:    { display: 'flex', alignItems: 'center', background: '#f8f9fa',
                  borderRadius: 8, padding: '10px 0' },
  deptStat:     { flex: 1, textAlign: 'center', display: 'flex',
                  flexDirection: 'column', gap: 3 },
  deptStatVal:  { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  deptStatLabel:{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em' },
  deptStatDivider:{ width: 1, height: 32, background: '#e0e0e0', flexShrink: 0 },
  burnTrack:    { height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  burnFill:     { height: '100%', borderRadius: 3, transition: 'width .5s' },
  changeWrap:   { display: 'flex', flexWrap: 'wrap', gap: 4 },
  changeChip:   { fontSize: 11, background: '#EBF4FF', color: '#378ADD',
                  padding: '2px 6px', borderRadius: 4 },
  pagination:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 0', marginTop: 8 },
  pageBtn:      { padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 8,
                  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#555' },
  pageInfo:     { fontSize: 13, color: '#888', padding: '6px 10px' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:        { background: '#fff', borderRadius: 16, padding: '32px 28px',
                  width: '100%', maxWidth: 480, position: 'relative',
                  maxHeight: '90vh', overflowY: 'auto' },
  closeBtn:     { position: 'absolute', top: 16, right: 16, background: 'none',
                  border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: 4 },
  modalTitle:   { fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 20px' },
  modalForm:    { display: 'flex', flexDirection: 'column', gap: 16 },
  userSummary:  { display: 'flex', alignItems: 'center', gap: 12, background: '#f8f9fa',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 20 },
  field:        { display: 'flex', flexDirection: 'column', gap: 6 },
  label:        { fontSize: 12, fontWeight: 500, color: '#555' },
  input:        { padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8,
                  fontSize: 13, outline: 'none', background: '#fafafa', color: '#1a1a1a',
                  boxSizing: 'border-box', width: '100%' },
  primaryBtn:   { padding: '10px 20px', background: '#378ADD', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:    { padding: '10px 20px', background: '#f0f0f0', color: '#555', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};