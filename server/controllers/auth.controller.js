const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User , RefreshToken } = require('../models/index')

const generateAccessToken = (user) => jwt.sign(
    {
    id:user.id,
    role:user.role,
    department_id:user.department_id
    },
    process.env.JWT_SECRET,
    {expiresIn:process.env.JWT_EXPIRES_IN}
);

const generateRefreshToken = ()=>{
    return crypto.randomBytes(64).toString('hex');
}

const hashToken = (token)=>{
    return crypto.createHash('sha256').update(token).digest('hex')
}


//register
exports.register = async(req,res)=>{
    try{
        if (!req.body.email) return res.status(400).json({ error: "Email is missing!" });
        
        const { name , email , password , role , department_id ,manager_id } = req.body
        if(!email || !name || !password || !role){
            return res.status(400).json({error: 'name,email,passsword are required...'});
        }

        const validRoles = ['ADMIN','MANAGER','EMPLOYEE'];
        if(!validRoles.includes(role)){
            return res.status(400).json({error:`role must be one of the ${validRoles.join(" , ")}`});
        }

        const existing = await User.findOne({where:{ email }})
        if(existing) return res.status(409).json({Error:'Email already registerd'})

        if(manager_id){
            const manager = await User.findByPk(manager_id)
            if(!manager){
                return res.status(400).json({error:"Manager id doesn't exist"})
            }
            if(manager.role==='EMPLOYEE'){
                return res.status(400).json({error:'Assigned manager must have MANAGER or ADMIN role'})
            }
        }

        const hashed = await bcrypt.hash(password,12);

        const user = await User.create({
            name,
            email,
            password:hashed,
            role,
            department_id: department_id||null,
            manager_id:manager_id||null
        });

        const { password : _,...userData} = user.toJSON();
        res.status(201).json({message:"User registered",user:userData})
    }
    catch(err){
        console.error("Register error: ",err);
        res.status(500).json({error:"Registration failed"});
    }
}

//login

exports.login = async(req,res)=>{
    try{
        const{email,password} = req.body

        if(!email || !password) {
            return res.status(400).json({error:'email and password are required'})
        }

        const user = await User.findOne({where:{ email }})
        if(!user){
            return res.status(401).json({error:"Invalid Credentials"});
        }

        if(!user.is_active){
            return res.status(403).json({error:"Account is deactivated"})
        }

        const valid = await bcrypt.compare(password,user.password);
        if(!valid){
            return res.status(401).json({error:'Invalid Credentials'})
        }

        //4.Generate access tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const tokenHash = hashToken(refreshToken) 
        //5 Store refresh token hash in DB
        await RefreshToken.create({
            user_id:user.id,
            token_hash: tokenHash,
            expires_at: new Date(Date.now()+7*24*60*60*1000),
            ip_address:req.ip,
            user_agent:req.headers['user-agent'] || null
        });

        //6 Return tokens + user data (new return password)
        const {password: _, ...UserData } = user.toJSON();
        res.json({
            accessToken,
            refreshToken,
            user:UserData
        })
    }
    catch(err){
        console.error('Login error: ',err);
        res.status(500).json({error:'Login failed'})
    }
};

    //---REFRESH-------------------
    exports.refresh = async(req,res)=>{
        try{
            const{refreshToken}=req.body;
            if(!refreshToken){
                return res.status(400).json({error:'Refresh token required'});
            }
            const tokenHash = hashToken(refreshToken);
            const storedToken = await RefreshToken.findOne({where:{token_hash:tokenHash}})

            if(!storedToken){
                return res.status(401).json({error:'Invalid refresh token'});
            }

            if(storedToken.revoked_at){
                return res.status(401).json({error:'Refresh token has been revoked'});
            }

            if(new Date() > storedToken.expires_at){
                return res.status(401).json({error:'Refresh token expired-please log in again'});
            }

            //4 Get the user
            const user = await User.findByPk(storedToken.user_id);
            if(!user || !user.is_active){
                return res.status(401).json({error:'User not found or deactivated'});
            }

            //5. Rotation-revoke old token , issue new one
            await storedToken.update({revoked_at:new Date()});
            const newRefreshToken = generateRefreshToken();
            const newTokenHash = hashToken(newRefreshToken);
            await RefreshToken.create({
                user_id:user.id,
                token_hash:newTokenHash,
                expires_at: new Date(Date.now()+7*24*60*60*1000),
                ip_address:req.ip,
                user_agent:req.headers['user-agent'] || null
            });

            const accessToken = generateAccessToken(user);

            res.json({accessToken , refreshToken:newRefreshToken});
        } 
        catch(err){
            console.error('Refresh error: ',err);
            res.status(500).json({error:'Token refresh failed'});
        }
    };

    exports.logout = async (req,res)=>{
        try{
            const {refreshToken} = req.body;
            if(!refreshToken){
                return res.status(400).json({error:'Refresh token required'});
            }
            const tokenHash = hashToken(refreshToken);
            const storedToken = await RefreshToken.findOne({where:{token_hash:tokenHash}});

            if(storedToken && !storedToken.revoked_at){
                await storedToken.update({revoked_at: new Date()});
            }
            res.json({message:'Logged out successfully'})
        } 
        catch(err){
            console.error('Logout Error:',err);
            res.status(500).json({error: 'Logout failed'})
        }
    }
