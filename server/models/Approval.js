const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Approval = sequelize.define('Approval', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    manager_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    expense_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true // Critical Business Logic: An expense can only be approved/rejected ONCE
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'approvals', 
    timestamps: true,
    createdAt: 'approved_at', 
    updatedAt: false,         
    
    underscored: true
});

module.exports = Approval;