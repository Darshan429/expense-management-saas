const { User, Department, Expense, Budget, AuditLog, sequelize } = require('../models/index');
const { QueryTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
// ── Helper: write audit log entry ────────────────────────────────────────────
const writeAudit = async (actorId, action, entityType, entityId, oldValues, newValues, ipAddress) => {
  try {
    await AuditLog.create({
      actor_id:    actorId,
      action,
      entity_type: entityType,
      entity_id:   entityId,
      old_values:  oldValues  ? JSON.stringify(oldValues)  : null,
      new_values:  newValues  ? JSON.stringify(newValues)  : null,
      ip_address:  ipAddress  || null
    });
  } catch (err) {
    // Never crash the main operation due to audit failure
    console.error('Audit log error:', err.message);
  }
};

// ══════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/users — list all users with department and manager info
exports.getAllUsers = async (req, res) => {
  try {
    const { role, department_id, is_active, search } = req.query;

    const where = {};
    if (role)          where.role          = role;
    if (department_id) where.department_id = department_id;
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    if (search) {
      where[Op.or] = [
        { name:  { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Department,
          as:    'department',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as:    'manager',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(users);

  } catch (err) {
    console.error('Get All Users Error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET /api/admin/users/:id — single user with full details
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { model: User, as: 'manager', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'subordinates', attributes: ['id', 'name', 'email', 'role'] }
      ]
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Also fetch their expense summary
    const [expenseSummary] = await sequelize.query(
      `SELECT
         COUNT(*)                                          AS total_expenses,
         COALESCE(SUM(CASE WHEN status='Approved'
                           THEN amount END), 0)           AS total_approved,
         COUNT(CASE WHEN status='Pending' THEN 1 END)     AS pending_count
       FROM expenses
       WHERE user_id = ? AND deleted_at IS NULL`,
      { replacements: [req.params.id], type: QueryTypes.SELECT }
    );

    res.json({ ...user.toJSON(), expense_summary: expenseSummary });

  } catch (err) {
    console.error('Get User Error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// PATCH /api/admin/users/:id/role — change user role
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from demoting themselves
    if (user.id === req.user.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    const oldRole = user.role;
    await user.update({ role });

    await writeAudit(
      req.user.id, 'UPDATED', 'USER', user.id,
      { role: oldRole }, { role },
      req.ip
    );

    res.json({ message: `Role changed to ${role}`, user: { id: user.id, name: user.name, role } });

  } catch (err) {
    console.error('Change Role Error:', err);
    res.status(500).json({ error: 'Failed to change role' });
  }
};

// PATCH /api/admin/users/:id/department — assign user to department
exports.assignDepartment = async (req, res) => {
  try {
    const { department_id } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (department_id) {
      const dept = await Department.findByPk(department_id);
      if (!dept) return res.status(404).json({ error: 'Department not found' });
    }

    const oldDeptId = user.department_id;
    await user.update({ department_id: department_id || null });

    await writeAudit(
      req.user.id, 'UPDATED', 'USER', user.id,
      { department_id: oldDeptId },
      { department_id },
      req.ip
    );

    res.json({ message: 'Department assigned', user: { id: user.id, name: user.name, department_id } });

  } catch (err) {
    console.error('Assign Department Error:', err);
    res.status(500).json({ error: 'Failed to assign department' });
  }
};

// PATCH /api/admin/users/:id/manager — assign manager
exports.assignManager = async (req, res) => {
  try {
    const { manager_id } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent self-manage
    if (manager_id && parseInt(manager_id) === user.id) {
      return res.status(400).json({ error: 'User cannot be their own manager' });
    }

    if (manager_id) {
      const manager = await User.findByPk(manager_id);
      if (!manager) return res.status(404).json({ error: 'Manager not found' });
      if (manager.role === 'EMPLOYEE') {
        return res.status(400).json({ error: 'Assigned manager must have MANAGER or ADMIN role' });
      }
    }

    await user.update({ manager_id: manager_id || null });

    res.json({ message: 'Manager assigned', user: { id: user.id, name: user.name, manager_id } });

  } catch (err) {
    console.error('Assign Manager Error:', err);
    res.status(500).json({ error: 'Failed to assign manager' });
  }
};

// PATCH /api/admin/users/:id/activate
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_active) return res.status(400).json({ error: 'User is already active' });

    await user.update({ is_active: true });

    await writeAudit(req.user.id, 'UPDATED', 'USER', user.id,
      { is_active: false }, { is_active: true }, req.ip);

    res.json({ message: `${user.name} has been activated` });

  } catch (err) {
    console.error('Activate User Error:', err);
    res.status(500).json({ error: 'Failed to activate user' });
  }
};

// PATCH /api/admin/users/:id/deactivate
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from deactivating themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    if (!user.is_active) return res.status(400).json({ error: 'User is already inactive' });

    const { reassign_manager_id } = req.body;

    await sequelize.transaction(async (t) => {
      // If this user is a manager, reassign their team first
      if (user.role === 'MANAGER') {
        await User.update(
          { manager_id: reassign_manager_id || null },
          { where: { manager_id: user.id }, transaction: t }
        );
      }
      await user.update({ is_active: false }, { transaction: t });
    });

    await writeAudit(req.user.id, 'UPDATED', 'USER', user.id,
      { is_active: true }, { is_active: false }, req.ip);

    res.json({ message: `${user.name} has been deactivated` });

  } catch (err) {
    console.error('Deactivate User Error:', err);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

// DELETE /api/admin/users/:id — soft delete
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Check if user has pending expenses
    const pendingCount = await Expense.count({
      where: { user_id: user.id, status: 'Pending', deleted_at: null }
    });

    if (pendingCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — user has ${pendingCount} pending expense(s). Resolve them first.`
      });
    }

    // Soft delete — deactivate and clear sensitive data
    await user.update({
      is_active:  false,
      deleted_at: new Date(),
      manager_id: null
    });

    await writeAudit(req.user.id, 'DELETED', 'USER', user.id,
      { name: user.name, email: user.email }, null, req.ip);

    res.json({ message: `${user.name} deleted successfully` });

  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPARTMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/departments — all departments with member count + budget info
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await sequelize.query(
      `SELECT
         d.id,
         d.name,
         d.description,
         d.created_at,
         COUNT(DISTINCT u.id)       AS member_count,
         COUNT(DISTINCT e.id)       AS total_expenses,
         COALESCE(bs.allocated_amount, 0) AS budget_allocated,
         COALESCE(bs.burn_pct, 0)         AS burn_pct,
         COALESCE(bs.remaining_amount, 0) AS budget_remaining
       FROM departments d
       LEFT JOIN users u
         ON u.department_id = d.id AND u.is_active = true
       LEFT JOIN expenses e
         ON e.department_id = d.id AND e.deleted_at IS NULL
       LEFT JOIN budget_summary bs
         ON bs.department_id = d.id
         AND bs.month = MONTH(NOW())
         AND bs.year  = YEAR(NOW())
       GROUP BY d.id
       ORDER BY d.name ASC`,
      { type: QueryTypes.SELECT }
    );

    res.json(departments);

  } catch (err) {
    console.error('Get Departments Error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

// POST /api/admin/departments — create department
exports.createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const dept = await Department.create({ name, description: description || null });

    await writeAudit(req.user.id, 'CREATED', 'DEPARTMENT', dept.id,
      null, { name, description }, req.ip);

    res.status(201).json({ message: 'Department created', department: dept });

  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    console.error('Create Department Error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

// PATCH /api/admin/departments/:id — update name or description
exports.updateDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const oldValues = { name: dept.name, description: dept.description };
    await dept.update({
      name:        name        || dept.name,
      description: description !== undefined ? description : dept.description
    });

    await writeAudit(req.user.id, 'UPDATED', 'DEPARTMENT', dept.id,
      oldValues, { name: dept.name, description: dept.description }, req.ip);

    res.json({ message: 'Department updated', department: dept });

  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    console.error('Update Department Error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

// DELETE /api/admin/departments/:id
exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    // Block if department has active members
    const memberCount = await User.count({
      where: { department_id: dept.id, is_active: true }
    });
    if (memberCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${memberCount} active member(s) still in this department. Reassign them first.`
      });
    }

    await dept.destroy();

    await writeAudit(req.user.id, 'DELETED', 'DEPARTMENT', dept.id,
      { name: dept.name }, null, req.ip);

    res.json({ message: `${dept.name} deleted successfully` });

  } catch (err) {
    console.error('Delete Department Error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/overview — system-wide KPIs for admin dashboard
exports.getSystemOverview = async (req, res) => {
  try {
    const [users, expenses, budgets, recentActivity] = await Promise.all([

      // User stats
      sequelize.query(
        `SELECT
           COUNT(*)                                    AS total_users,
           COUNT(CASE WHEN role='ADMIN'    THEN 1 END) AS admin_count,
           COUNT(CASE WHEN role='MANAGER'  THEN 1 END) AS manager_count,
           COUNT(CASE WHEN role='EMPLOYEE' THEN 1 END) AS employee_count,
           COUNT(CASE WHEN is_active=false THEN 1 END) AS inactive_count
         FROM users`,
        { type: QueryTypes.SELECT }
      ),

      // Expense stats — this month
      sequelize.query(
        `SELECT
           COUNT(*)                                              AS total_this_month,
           COUNT(CASE WHEN status='Pending'  THEN 1 END)        AS pending,
           COUNT(CASE WHEN status='Approved' THEN 1 END)        AS approved,
           COUNT(CASE WHEN status='Rejected' THEN 1 END)        AS rejected,
           COALESCE(SUM(CASE WHEN status='Approved'
                             THEN amount END), 0)               AS approved_spend,
           COALESCE(AVG(CASE WHEN status='Approved'
                             THEN amount END), 0)               AS avg_expense
         FROM expenses
         WHERE deleted_at IS NULL
           AND MONTH(created_at) = MONTH(NOW())
           AND YEAR(created_at)  = YEAR(NOW())`,
        { type: QueryTypes.SELECT }
      ),

      // Budget health — departments over 80%
      sequelize.query(
        `SELECT COUNT(*) AS over_80_count
         FROM budget_summary
         WHERE burn_pct >= 80`,
        { type: QueryTypes.SELECT }
      ),

      // Recent activity — last 10 audit log entries
      sequelize.query(
        `SELECT
           al.*,
           u.name AS actor_name
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_id
         ORDER BY al.created_at DESC
         LIMIT 10`,
        { type: QueryTypes.SELECT }
      )
    ]);

    res.json({
      users:           users[0],
      expenses:        expenses[0],
      budget_alerts:   budgets[0],
      recent_activity: recentActivity
    });

  } catch (err) {
    console.error('System Overview Error:', err);
    res.status(500).json({ error: 'Failed to fetch system overview' });
  }
};

// GET /api/admin/audit-log — paginated audit log
exports.getAuditLog = async (req, res) => {
  try {
    const { page = 1, limit = 20, entity_type, action } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions   = [];
    let replacements = [];

    if (entity_type) {
      conditions.push('al.entity_type = ?');
      replacements.push(entity_type);
    }
    if (action) {
      conditions.push('al.action = ?');
      replacements.push(action);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [logs, [{ total }]] = await Promise.all([
      sequelize.query(
        `SELECT
           al.id,
           al.action,
           al.entity_type,
           al.entity_id,
           al.old_values,
           al.new_values,
           al.ip_address,
           al.created_at,
           u.name  AS actor_name,
           u.email AS actor_email,
           u.role  AS actor_role
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        {
          replacements: [...replacements, parseInt(limit), offset],
          type: QueryTypes.SELECT
        }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS total FROM audit_log al ${where}`,
        { replacements, type: QueryTypes.SELECT }
      )
    ]);

    res.json({
      logs,
      pagination: {
        total:       parseInt(total),
        page:        parseInt(page),
        limit:       parseInt(limit),
        total_pages: Math.ceil(parseInt(total) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Audit Log Error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};