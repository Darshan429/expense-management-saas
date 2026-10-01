const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'BUDGET_ALERT', 'NEW_SUBMISSION'),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    message: {
        type: DataTypes.STRING(500), 
        allowNull: false
    },
    expense_id: {
        type: DataTypes.INTEGER,
        allowNull: true 
    },
    is_read: {
        type: DataTypes.BOOLEAN, 
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'notifications', 
    timestamps: true,
    createdAt: 'created_at', 
    updatedAt: false,        
    underscored: true
});

module.exports = Notification;