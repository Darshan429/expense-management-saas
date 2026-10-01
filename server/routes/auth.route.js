const express =require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

router.post('/register',controller.register);
router.post('/login',controller.login);
router.post('/refresh',controller.refresh);

router.post('/logout',protect,controller.logout);

router.get('/me',protect , (req,res)=>{
 res.json({user:req.user})
})

module.exports = router 