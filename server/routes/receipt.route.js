const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/receipt.controller');
const { protect } = require('../middleware/auth.middleware');
const upload      = require('../middleware/upload.middleware');
// All receipt routes require login
router.post('/scan', protect, upload.single('receipt'), controller.scanReceipt);
module.exports = router;