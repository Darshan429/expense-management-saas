const { sequelize } = require('../models/index');
const { QueryTypes } = require('sequelize');

// ── Helper: build role-based WHERE clause ─────────────────────────────────────
// Returns { clause, replacements } based on who is asking
const getRoleFilter = (user, tableAlias = 'e') => {
  if (user.role === 'EMPLOYEE') {
    return {
      clause:       `AND ${tableAlias}.user_id = ?`,
      replacements: [user.id]
    };
  }
  if (user.role === 'MANAGER') {
    return {
      clause:       `AND ${tableAlias}.department_id = ?`,
      replacements: [user.department_id]
    };
  }
  // ADMIN — no filter, sees everything
  return { clause: '', replacements: [] };
};

// ── Helper: date range filter ─────────────────────────────────────────────────
// ?range=30d | 90d | ytd | all   (default: 30d)
const getDateFilter = (range) => {
  switch (range) {
    case '90d':
      return `AND e.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
    case 'ytd':
      return `AND YEAR(e.created_at) = YEAR(NOW())`;
    case 'all':
      return '';
    case '30d':
    default:
      return `AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }
};

// ── GET SUMMARY — KPI cards ───────────────────────────────────────────────────
// Returns: total_spend, pending_count, approved_count, rejected_count, avg_expense
exports.getSummary = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const dateFilter = getDateFilter(range);
    const roleFilter = getRoleFilter(req.user);

    const [summary] = await sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN e.status = 'Approved' THEN e.amount ELSE 0 END), 0)
           AS total_spend,
         COUNT(CASE WHEN e.status = 'Pending'  THEN 1 END) AS pending_count,
         COUNT(CASE WHEN e.status = 'Approved' THEN 1 END) AS approved_count,
         COUNT(CASE WHEN e.status = 'Rejected' THEN 1 END) AS rejected_count,
         COUNT(*)                                          AS total_count,
         COALESCE(AVG(CASE WHEN e.status = 'Approved' THEN e.amount END), 0)
           AS avg_expense
       FROM expenses e
       WHERE e.deleted_at IS NULL
         ${dateFilter}
         ${roleFilter.clause}`,
      {
        replacements: roleFilter.replacements,
        type: QueryTypes.SELECT
      }
    );

    res.json(summary);

  } catch (err) {
    console.error('Summary Error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
};

// ── GET MONTHLY TREND — bar chart data ───────────────────────────────────────
// Returns last 6 months: { month, year, total_spend, expense_count }
exports.getMonthlyTrend = async (req, res) => {
  try {
    const { range = '6months' } = req.query;
    const roleFilter = getRoleFilter(req.user);

    const months = range === '12months' ? 12 : 6;

    const rows = await sequelize.query(
      `SELECT
         DATE_FORMAT(e.created_at, '%Y-%m')        AS period,
         DATE_FORMAT(e.created_at, '%b-%Y')        AS label,
         COALESCE(SUM(e.amount), 0)                AS total_spend,
         COUNT(*)                                   AS expense_count
       FROM expenses e
       WHERE e.status     = 'APPROVED'
         AND e.deleted_at IS NULL
         AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
         ${roleFilter.clause}
       GROUP BY DATE_FORMAT(e.created_at, '%Y-%m'),
                DATE_FORMAT(e.created_at, '%b-%Y')
       ORDER BY period ASC`,
      {
        replacements: [months, ...roleFilter.replacements],
        type: QueryTypes.SELECT
      }
    );

    res.json(rows);

  } catch (err) {
    console.error('Monthly Trend Error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
};

// ── GET CATEGORY BREAKDOWN — pie chart data ───────────────────────────────────
// Returns: { category, total, count, percentage }
exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const dateFilter = getDateFilter(range);
    const roleFilter = getRoleFilter(req.user);

    const rows = await sequelize.query(
      `SELECT
         e.category,
         COALESCE(SUM(e.amount), 0)       AS total,
         COUNT(*)                          AS count,
         ROUND(
           SUM(e.amount) * 100.0 /
           (SELECT SUM(amount) FROM expenses
            WHERE status = 'Approved'
              AND deleted_at IS NULL
              ${dateFilter.replace('e.', '')}
              ${roleFilter.clause.replace('e.', '')}
           ), 1
         )                                AS percentage
       FROM expenses e
       WHERE e.status     = 'Approved'
         AND e.deleted_at IS NULL
         ${dateFilter}
         ${roleFilter.clause}
       GROUP BY e.category
       ORDER BY total DESC`,
      {
        replacements: [
          ...roleFilter.replacements,  // for subquery
          ...roleFilter.replacements   // for outer query
        ],
        type: QueryTypes.SELECT
      }
    );

    res.json(rows);

  } catch (err) {
    console.error('Category Breakdown Error:', err);
    res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
};

// ── GET DEPARTMENT BREAKDOWN — admin only ─────────────────────────────────────
// Returns: { department_name, total_spend, expense_count, budget, burn_pct }
exports.getDepartmentBreakdown = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const dateFilter = getDateFilter(range);

    const rows = await sequelize.query(
      `SELECT
         d.id                                       AS department_id,
         d.name                                     AS department_name,
         COALESCE(SUM(e.amount), 0)                AS total_spend,
         COUNT(e.id)                                AS expense_count,
         COALESCE(bs.allocated_amount, 0)           AS budget_allocated,
         COALESCE(bs.burn_pct, 0)                  AS burn_pct,
         COALESCE(bs.remaining_amount, 0)           AS remaining_amount
       FROM departments d
       LEFT JOIN expenses e
         ON e.department_id = d.id
         AND e.status       = 'Approved'
         AND e.deleted_at   IS NULL
         ${dateFilter}
       LEFT JOIN budget_summary bs
         ON bs.department_id = d.id
         AND bs.month = MONTH(NOW())
         AND bs.year  = YEAR(NOW())
       GROUP BY d.id
       ORDER BY total_spend DESC`,
      { type: QueryTypes.SELECT }
    );

    res.json(rows);

  } catch (err) {
    console.error('Department Breakdown Error:', err);
    res.status(500).json({ error: 'Failed to fetch department breakdown' });
  }
};

// ── GET TOP SPENDERS ──────────────────────────────────────────────────────────
// Returns: top 5 employees by approved spend
exports.getTopSpenders = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const dateFilter = getDateFilter(range);

    // Managers only see their department
    let deptFilter = '';
    let replacements = [];
    if (req.user.role === 'MANAGER') {
      deptFilter = 'AND e.department_id = ?';
      replacements.push(req.user.department_id);
    }

    const rows = await sequelize.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         d.name                          AS department_name,
         COALESCE(SUM(e.amount), 0)     AS total_spent,
         COUNT(e.id)                     AS expense_count,
         COALESCE(AVG(e.amount), 0)     AS avg_expense
       FROM users u
       LEFT JOIN expenses e
         ON e.user_id     = u.id
         AND e.status     = 'Approved'
         AND e.deleted_at IS NULL
         ${dateFilter}
         ${deptFilter}
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.role = 'EMPLOYEE'
       GROUP BY u.id
       ORDER BY total_spent DESC
       LIMIT 5`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json(rows);

  } catch (err) {
    console.error('Top Spenders Error:', err);
    res.status(500).json({ error: 'Failed to fetch top spenders' });
  }
};