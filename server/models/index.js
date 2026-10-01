const sequelize = require('../config/db');
const User = require('./User');
const Department = require('./Department');
const Expense = require('./Expense');
const Budget = require('./Budget');
const Notification = require('./Notification');
const RefreshToken = require('./RefreshToken');
const Approval = require('./Approval');
const AuditLog = require('./AuditLog');

User.belongsTo(Department, { foreignKey: 'department_id' , as:'department'});
User.belongsTo(User, { foreignKey:'manager_id' , as:'manager' });
User.hasMany(User,{ foreignKey: 'manager_id' , as: 'subordinates' });
User.hasMany(Expense,{ foreignKey: 'user_id' , as: 'expenses' });
User.hasMany(Notification, { foreignKey: 'user_id' , as: 'notifications'});
User.hasMany(RefreshToken,{ foreignKey: 'user_id' , as:'refreshTokens' });

Department.hasMany(User,{foreignKey:'department_id'});
Department.hasMany(Budget,{foreignKey:'department_id'});
Department.hasMany(Expense,{foreignKey:'department_id'});

Expense.belongsTo(User,{ foreignKey:'user_id', as:'SubmittedBy' });
Expense.belongsTo(Department,{ foreignKey:'department_id' , as:'department' });
Expense.hasOne(Approval,{foreignKey:'expense_id' , as:'approval' });
Expense.hasMany(Notification,{foreignKey:'expense_id'});

Budget.belongsTo(Department, { foreignKey: 'department_id' });

Approval.belongsTo(Expense, { foreignKey: 'expense_id' });
Approval.belongsTo(User,    { foreignKey: 'manager_id', as: 'manager' });
AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

module.exports = {
    sequelize,
    User,
    Department, 
    Expense, 
    Budget,
    Approval, 
    Notification, 
    AuditLog, 
    RefreshToken
};