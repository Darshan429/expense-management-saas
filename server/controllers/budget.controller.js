const { Budget, Department, sequelize } = require('../models/index');
const { QueryTypes } = require('sequelize');
const { notify } = require('../services/notification.service');

// ── CREATE BUDGET ─────────────────────────────────────────────────────────────
exports.createBudget = async (req, res) => {
  try {
    const { department_id, allocated_amount, month, year } = req.body;

    // Validate required fields
    if (!department_id || !allocated_amount || !month || !year) {
      return res.status(400).json({
        error: 'department_id, allocated_amount, month and year are required'
      });
    }

    // Validate month range
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'month must be between 1 and 12' });
    }

    // Validate amount
    if (allocated_amount <= 0) {
      return res.status(400).json({ error: 'allocated_amount must be greater than 0' });
    }

    // Confirm department exists
    const department = await Department.findByPk(department_id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // period is always first day of the month — stored as DATE
    // e.g. month=6, year=2025 → period = '2025-06-01'
    const period = new Date(year, month - 1, 1);

    // Check if budget already exists for this dept + month
    // UNIQUE(department_id, period) constraint will also catch this
    const existing = await Budget.findOne({
      where: { department_id, period }
    });
    if (existing) {
      return res.status(409).json({
        error: `Budget already exists for ${department.name} in ${month}/${year}. Use PATCH to update it.`
      });
    }

    const budget = await Budget.create({
      department_id,
      period,
      allocated_amount,
      alert_80_sent:  false,
      alert_100_sent: false
    });

    res.status(201).json({
      message: 'Budget created successfully',
      budget
    });

  } catch (err) {
    // Handle Sequelize unique constraint error
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Budget already exists for this department and month' });
    }
    console.error('Create Budget Error:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
};

// ── GET ALL BUDGETS (with live burn rate from VIEW) ────────────────────────────
exports.getBudgets = async (req, res) => {
  try {
    const { month, year, department_id } = req.query;

    // Build WHERE clause dynamically
    let conditions  = [];
    let replacements = [];

    // Managers only see their own department
    if (req.user.role === 'MANAGER') {
      conditions.push('bs.department_id = ?');
      replacements.push(req.user.department_id);
    } else if (department_id) {
      // Admin can filter by department
      conditions.push('bs.department_id = ?');
      replacements.push(department_id);
    }

    if (month) {
      conditions.push('bs.month = ?');
      replacements.push(parseInt(month));
    }
    if (year) {
      conditions.push('bs.year = ?');
      replacements.push(parseInt(year));
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Query the budget_summary VIEW — gives live used/remaining/burn_pct
    const budgets = await sequelize.query(
      `SELECT
         bs.*,
         d.name AS department_name
       FROM budget_summary bs
       JOIN departments d ON d.id = bs.department_id
       ${whereClause}
       ORDER BY bs.year DESC, bs.month DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json(budgets);

  } catch (err) {
    console.error('Get Budgets Error:', err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
};

// ── GET SINGLE BUDGET ──────────────────────────────────────────────────────────
exports.getBudgetById = async (req, res) => {
  try {
    const [budget] = await sequelize.query(
      `SELECT bs.*, d.name AS department_name
       FROM budget_summary bs
       JOIN departments d ON d.id = bs.department_id
       WHERE bs.id = ?`,
      { replacements: [req.params.id], type: QueryTypes.SELECT }
    );

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Manager can only view their own department's budget
    if (req.user.role === 'MANAGER' &&
        budget.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Not authorized to view this budget' });
    }

    res.json(budget);

  } catch (err) {
    console.error('Get Budget Error:', err);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
};

// ── UPDATE BUDGET ──────────────────────────────────────────────────────────────
exports.updateBudget = async (req, res) => {
  try {
    const { allocated_amount } = req.body;

    if (!allocated_amount || allocated_amount <= 0) {
      return res.status(400).json({ error: 'Valid allocated_amount is required' });
    }

    const budget = await Budget.findByPk(req.params.id);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await budget.update({ allocated_amount });

    // Re-fetch from VIEW so response includes updated burn_pct
    const [updated] = await sequelize.query(
      'SELECT * FROM budget_summary WHERE id = ?',
      { replacements: [budget.id], type: QueryTypes.SELECT }
    );

    res.json({ message: 'Budget updated', budget: updated });

  } catch (err) {
    console.error('Update Budget Error:', err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
};

// ── CHECK BUDGET THRESHOLD AND NOTIFY ─────────────────────────────────────────
// Called from expense.controller.js after every approval
// Checks if burn_pct crossed 80% or 100% and sends one-time alert
exports.checkBudgetAlert = async (departmentId, managerId) => {
  try {
    // Get current month's budget from VIEW
    const [budget] = await sequelize.query(
      `SELECT * FROM budget_summary
       WHERE department_id = ?
         AND month = MONTH(NOW())
         AND year  = YEAR(NOW())`,
      { replacements: [departmentId], type: QueryTypes.SELECT }
    );

    if (!budget) return;  // no budget set for this dept this month

    const budgetRow = await Budget.findByPk(budget.id);

    // 100% alert — fires first if both thresholds crossed simultaneously
    if (budget.burn_pct >= 100 && !budgetRow.alert_100_sent) {
      await budgetRow.update({ alert_100_sent: true });
      await notify({
        userId:  managerId,
        type:    'BUDGET_ALERT',
        title:   'Budget fully consumed!',
        message: `${budget.department_name} has used 100% of its monthly budget (Rs.${budget.allocated_amount}).`
      });
      return;  // don't also send 80% alert
    }

    // 80% alert
    if (budget.burn_pct >= 80 && !budgetRow.alert_80_sent) {
      await budgetRow.update({ alert_80_sent: true });
      await notify({
        userId:  managerId,
        type:    'BUDGET_ALERT',
        title:   'Budget at 80%',
        message: `${budget.department_name} has used ${budget.burn_pct}% of its monthly budget. Rs.${budget.remaining_amount} remaining.`
      });
    }

  } catch (err) {
    // Never crash the approval flow due to alert failure
    console.error('Budget alert check error:', err.message);
  }
};