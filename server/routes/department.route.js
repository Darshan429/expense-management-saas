// server/routes/department.route.js
const express    = require('express');
const router     = express.Router();
const { Department } = require('../models/index');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Create department (Admin only)
router.post('/', protect, restrictTo('ADMIN'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const dept = await Department.create({ name, description });
    res.status(201).json(dept);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// List all departments
router.get('/', async (req, res) => {
  try {
    const depts = await Department.findAll({ order: [['name', 'ASC']] });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

module.exports = router;












