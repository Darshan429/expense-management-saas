const express        = require('express');
const router          = express.Router();
const expenseController  = require('../controllers/expense.controller');
const receiptController  = require('../controllers/receipt.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const upload           = require('../middleware/upload.middleware');

router.post('/',              protect, upload.single('receipt'), expenseController.createExpense);
router.get('/',                protect, expenseController.getExpenses);
router.post('/scan',           protect, upload.single('receipt'), receiptController.scanReceipt);
router.get('/:id',             protect, expenseController.getExpenseById);
router.patch('/:id/approve',   protect, restrictTo('MANAGER', 'ADMIN'), expenseController.approveExpense);
router.delete('/:id',          protect, expenseController.deleteExpense);

module.exports = router;