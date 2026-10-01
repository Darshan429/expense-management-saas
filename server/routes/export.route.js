// server/routes/export.route.js
const express      = require('express');
const router       = express.Router();
const { Parser }   = require('json2csv');
const PDFDocument  = require('pdfkit');
const { sequelize } = require('../models/index');
const { QueryTypes } = require('sequelize');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Helpers ──────────────────────────────────────────────────────────
const getRoleFilter = (user) => {
  if (user.role === 'EMPLOYEE') {
    return { clause: 'AND e.user_id = ?', replacements: [user.id] };
  }
  if (user.role === 'MANAGER') {
    return { clause: 'AND e.department_id = ?', replacements: [user.department_id] };
  }
  return { clause: '', replacements: [] };
};

const getDateFilter = (range) => {
  switch (range) {
    case '90d': return `AND e.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
    case 'ytd': return `AND YEAR(e.created_at) = YEAR(NOW())`;
    case 'all': return '';
    default:    return `AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }
};

const fetchExpenses = async (user, query) => {
  const { range = '30d', status, category } = query;
  const roleFilter = getRoleFilter(user);
  const dateFilter = getDateFilter(range);

  let extraFilters = '';
  if (status)   extraFilters += ` AND e.status = '${status}'`;
  if (category) extraFilters += ` AND e.category = '${category}'`;

  return sequelize.query(
    `SELECT
       e.id,
       u.name        AS submitted_by,
       d.name        AS department,
       e.amount,
       e.category,
       e.description,
       e.status,
       e.receipt_url,
       e.created_at  AS submitted_at,
       a_user.name   AS actioned_by,
       ap.comment    AS manager_comment,
       ap.approved_at AS actioned_at
     FROM expenses e
     JOIN users u        ON u.id = e.user_id
     JOIN departments d  ON d.id = e.department_id
     LEFT JOIN approvals ap  ON ap.expense_id = e.id
     LEFT JOIN users a_user  ON a_user.id = ap.manager_id
     WHERE e.deleted_at IS NULL
       ${dateFilter}
       ${roleFilter.clause}
       ${extraFilters}
     ORDER BY e.created_at DESC`,
    { replacements: roleFilter.replacements, type: QueryTypes.SELECT }
  );
};

// ── CSV ── GET /api/export/csv ────────────────────────────────────────────────
router.get('/csv', protect, async (req, res) => {
  try {
    const rows = await fetchExpenses(req.user, req.query);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No expenses found for selected filters' });
    }

    const fields = [
      { label: 'ID',              value: 'id' },
      { label: 'Submitted By',    value: 'submitted_by' },
      { label: 'Department',      value: 'department' },
      { label: 'Amount (Rs.)',    value: 'amount' },
      { label: 'Category',        value: 'category' },
      { label: 'Description',     value: 'description' },
      { label: 'Status',          value: 'status' },
      { label: 'Submitted At',    value: 'submitted_at' },
      { label: 'Actioned By',     value: 'actioned_by' },
      { label: 'Manager Comment', value: 'manager_comment' },
      { label: 'Actioned At',     value: 'actioned_at' },
    ];

    const csv      = new Parser({ fields }).parse(rows);
    const filename = `expenses_${req.query.range || '30d'}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// ── PDF ── GET /api/export/pdf ────────────────────────────────────────────────
router.get('/pdf', protect, restrictTo('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const rows = await fetchExpenses(req.user, req.query);

    const totalSpend    = rows.filter(r => r.status === 'Approved')
                              .reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const approvedCount = rows.filter(r => r.status === 'Approved').length;
    const pendingCount  = rows.filter(r => r.status === 'Pending').length;
    const rejectedCount = rows.filter(r => r.status === 'Rejected').length;

    const filename = `expense_report_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc   = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    doc.pipe(res);

    const BLUE  = '#378ADD';
    const DARK  = '#1a1a1a';
    const MID   = '#444444';
    const LIGHT = '#888888';
    const GREEN = '#1D9E75';
    const RED   = '#D85A30';
    const AMBER = '#BA7517';
    const W     = doc.page.width;
    const M     = 40;

    // Header
    doc.rect(0, 0, W, 90).fill(BLUE);
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
       .text('Expense Report', M, 24);
    doc.fontSize(10).fillColor('#BDD7FF').font('Helvetica')
       .text(
         `Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}` +
         `  |  Period: ${req.query.range || '30d'}  |  By: ${req.user.name}`,
         M, 52
       );

    // KPI boxes
    const kpis = [
      { label: 'Total Approved', value: `Rs.${totalSpend.toLocaleString('en-IN')}`, color: BLUE  },
      { label: 'Approved',       value: approvedCount,                               color: GREEN },
      { label: 'Pending',        value: pendingCount,                                color: AMBER },
      { label: 'Rejected',       value: rejectedCount,                               color: RED   },
    ];

    const boxW = (W - M * 2 - 24) / 4;
    let bx = M;
    const by = 105;

    kpis.forEach(k => {
      doc.roundedRect(bx, by, boxW, 56, 6).fill('#EEF5FF');
      doc.rect(bx, by, boxW, 4).fill(k.color);
      doc.fontSize(8).fillColor(LIGHT).font('Helvetica')
         .text(k.label.toUpperCase(), bx + 10, by + 12, { width: boxW - 20 });
      doc.fontSize(18).fillColor(DARK).font('Helvetica-Bold')
         .text(String(k.value), bx + 10, by + 26, { width: boxW - 20 });
      bx += boxW + 8;
    });

    doc.y = by + 72;

    // Category bars
    doc.fontSize(11).fillColor(BLUE).font('Helvetica-Bold')
       .text('Spend by Category', M, doc.y);
    doc.moveDown(0.4);

    const catMap    = {};
    rows.filter(r => r.status === 'Approved')
        .forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + parseFloat(r.amount); });

    const catColors = { Travel: BLUE, Meals: GREEN, Software: AMBER, Office: RED, Other: '#534AB7' };
    const barMaxW   = W - M * 2 - 110;
    const maxVal    = Math.max(...Object.values(catMap), 1);

    Object.entries(catMap).sort(([,a],[,b]) => b - a).forEach(([cat, total]) => {
      const barW = (total / maxVal) * barMaxW;
      doc.fontSize(9).fillColor(MID).font('Helvetica')
         .text(cat, M, doc.y, { width: 70 });
      const barY = doc.y - 11;
      doc.roundedRect(M + 75, barY, Math.max(barW, 4), 11, 3).fill(catColors[cat] || BLUE);
      doc.fontSize(9).fillColor(LIGHT)
         .text(`Rs.${total.toLocaleString('en-IN')}`, M + 82 + barW, barY, { width: 100 });
      doc.moveDown(0.5);
    });

    doc.moveDown(0.4);
    doc.moveTo(M, doc.y).lineTo(W - M, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(0.6);

    // Expense table
    doc.fontSize(11).fillColor(BLUE).font('Helvetica-Bold')
       .text(`All Expenses (${rows.length} records)`, M, doc.y);
    doc.moveDown(0.5);

    const cols = [
      { label: 'id',          width: 28, key: 'id' },
      { label: 'Employee',   width: 90, key: 'submitted_by' },
      { label: 'Department', width: 80, key: 'department' },
      { label: 'Amount',     width: 65, key: 'amount' },
      { label: 'Category',   width: 65, key: 'category' },
      { label: 'Status',     width: 60, key: 'status' },
      { label: 'Date',       width: 70, key: 'submitted_at' },
    ];

    const statusColors = { Approved: GREEN, Rejected: RED, Pending: AMBER };

    const drawRow = (row, y, isHeader = false, isEven = false) => {
      doc.rect(M, y - 4, W - M * 2, 20)
         .fill(isHeader ? BLUE : (isEven ? '#F5F8FF' : '#FFFFFF'));

      let x = M + 4;
      cols.forEach(col => {
        let val = isHeader ? col.label : (row[col.key] ?? '');
        if (!isHeader) {
          if (col.key === 'amount')       val = `Rs.${parseFloat(val).toLocaleString('en-IN')}`;
          if (col.key === 'submitted_at') val = val ? new Date(val).toLocaleDateString('en-IN') : '';
        }
        const color = (!isHeader && col.key === 'status')
          ? (statusColors[val] || DARK)
          : (isHeader ? '#ffffff' : DARK);

        doc.fontSize(8).fillColor(color)
           .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
           .text(String(val), x, y, { width: col.width - 4, ellipsis: true, lineBreak: false });
        x += col.width;
      });
    };

    let tableY = doc.y + 4;
    drawRow(null, tableY, true);
    tableY += 20;

    rows.forEach((row, i) => {
      if (tableY > doc.page.height - 80) {
        doc.addPage();
        tableY = 50;
        drawRow(null, tableY, true);
        tableY += 20;
      }
      drawRow(row, tableY, false, i % 2 === 0);
      tableY += 20;
    });

    // Footer on every page
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(LIGHT).font('Helvetica')
         .text(
           `Page ${i + 1} of ${totalPages}  |  Team Expense Management SaaS  |  Confidential`,
           M, doc.page.height - 30,
           { width: W - M * 2, align: 'center' }
         );
    }

    doc.end();

  } catch (err) {
    console.error('PDF Export Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;  // ← routes ARE attached to router now