const jwt  = require('jsonwebtoken');
const { User } = require('../models/index');

exports.protect = async(req,res,next)=>{
    try{
        const authHeader = req.headers.authorization
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({error:'No Token provided'})
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token,process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.id,{attributes:{exclude:['password']}})

        if(!user || !user.is_active){
            return res.status(401).json({error:'User no longer exists or is deactivated'})
        }

        req.user = user;
        next();
    } catch(err){
        if(err.name=='TokenExpiredError'){
            return res.status(401).json({error:"Token expired",code:"TOKEN_EXPIRED"})
        }
        if(err.name=='JsonWebTokenError'){
            return res.status(401).json({error:'Invalid Token'})
        }
        res.status(500).json({error:'Auth check failed'});
    }
}

exports.restrictTo=(...roles)=>(req,res,next)=>{
    if(!roles.includes(req.user.role)){
        return res.status(403).json({
            error:`Access-Denied requires one of :${roles.join(',')}`
        })
    }
    next();
}