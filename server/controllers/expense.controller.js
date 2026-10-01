const { Expense, User, sequelize } = require('../models/index');
const { notify } = require('../services/notification.service');
const { checkBudgetAlert } = require('./budget.controller');

// ── CREATE ───────────────────────────────────────────────────────────────────
exports.createExpense = async (req, res) => {
  try {
    const { amount, description, category, department_id } = req.body;


    // Validate required fields
    if (!amount || !category) {
      return res.status(400).json({ error: 'amount and category are required' });
    }

    const receipt_url = req.file ? req.file.path : null;

    const VALID_CATEGORIES = ['Travel', 'Meals', 'Software', 'Office', 'Other'];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    // department_id comes from the user's own profile if not explicitly passed
    const finalDepartmentId = department_id || req.user.department_id;
    if (!finalDepartmentId) {
      return res.status(400).json({ error: 'department_id is required — user has no department assigned' });
    }

    

    const newExpense = await Expense.create({
      amount,
      description: description || null,
      category,
      status:        'Pending',          // matches your ENUM exactly
      user_id:       req.user.id,
      department_id: finalDepartmentId,
      receipt_url
    });

    // Notify the employee's manager about the new submission
    if (req.user.manager_id) {
      await notify({
        userId:    req.user.manager_id,
        type:      'EXPENSE_SUBMITTED',
        title:     'New expense submitted',
        message:   `${req.user.name} submitted a ₹${amount} ${category} expense for approval.`,
        expenseId: newExpense.id
      });
    }

    res.status(201).json({ message: 'Expense submitted successfully', expense: newExpense });

  } catch (error) {
    console.error("Expense Fetch Error:", error); // Logs to your terminal
    res.status(500).json({ 
        error: "Failed to fetch expenses", 
        details: error.message 
    });
}
};

// ── LIST (role-filtered) ──────────────────────────────────────────────────────
exports.getExpenses = async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = {};

    // Role-based visibility
    if (req.user.role === 'EMPLOYEE') {
      where.user_id = req.user.id;               // only their own
    } else if (req.user.role === 'MANAGER') {
      where.department_id = req.user.department_id; // only their department
    }
    // ADMIN sees everything — no filter added

    if (status)   where.status   = status;
    if (category) where.category = category;

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(expenses);

  } catch (error) {
    console.error('Get Expenses Error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

// ── GET SINGLE ─────────────────────────────────────────────────────────────────
exports.getExpenseById = async (req, res) => {
  try {
    const { Approval } = require('../models/index');

    const expense = await Expense.findByPk(req.params.id, {
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'name', 'email'] },
        {
          model: Approval,
          as: 'approval',
          required: false,
          include: [
            { model: User, as: 'manager', attributes: ['id', 'name'] }
          ]
        }
      ]
    });

    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    if (req.user.role === 'EMPLOYEE' && expense.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(expense);

  } catch (error) {
    console.error('Get Expense Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ── APPROVE / REJECT ───────────────────────────────────────────────────────────
exports.approveExpense = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    // Matches your ENUM exactly — capitalized
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be Approved or Rejected' });
    }

    // Only managers and admins can approve
    if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers can approve expenses' });
    }

    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Manager can only approve expenses in their own department
    if (req.user.role === 'MANAGER' && expense.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Not authorized — different department' });
    }

    // Already-decided expenses can't be re-approved
    if (expense.status.toLowerCase() !== 'pending') {
      return res.status(409).json({ error: `Expense already ${expense.status.toLowerCase()}` });
    }

    // Transaction: status update + approval record together
    await sequelize.transaction(async (t) => {
      await expense.update({ status }, { transaction: t });

      const { Approval } = require('../models/index');
      await Approval.create({
        expense_id: expense.id,
        manager_id: req.user.id,
        comment:    remarks || null
      }, { transaction: t });
    });

    // Notify the employee — outside transaction, never blocks the approval
    const isApproved = status === 'Approved';
    await notify({
      userId:    expense.user_id,
      type:      isApproved ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      title:     isApproved ? 'Expense approved ✓' : 'Expense rejected',
      message:   isApproved
        ? `Your ₹${expense.amount} ${expense.category} expense was approved.`
        : `Your ₹${expense.amount} ${expense.category} expense was rejected.${remarks ? ' ' + remarks : ''}`,
      expenseId: expense.id
    });

    // After notify() call — check if budget threshold crossed
    if (status === 'Approved') {
      await checkBudgetAlert(expense.department_id, req.user.id);
    }

    res.status(200).json({ message: `Expense ${status.toLowerCase()} successfully`, expense });

  } catch (error) {
    console.error('Approve Expense Error:', error);   // ← was empty before, fixed
    res.status(500).json({ error: 'Failed to process approval' });
  }
};

// ── DELETE (soft delete, admin only) ──────────────────────────────────────────
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Only admin can delete; employees can only delete their own Pending expenses
    const isOwner   = expense.user_id === req.user.id;
    const isPending  = expense.status === 'Pending';
    const isAdmin    = req.user.role === 'ADMIN';

    if (!isAdmin && !(isOwner && isPending)) {
      return res.status(403).json({
        error: 'You can only delete your own pending expenses'
      });
    }

    // Soft delete — never hard-delete financial records
    await expense.update({ deleted_at: new Date() });
    // Requires a deleted_at column on expenses — add it if not present:
    // ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

    res.status(200).json({ message: 'Expense deleted successfully' });

  } catch (error) {
    console.error('Delete Expense Error:', error);
    res.status(500).json({ error: 'Failed to delete the expense' });
  }
};