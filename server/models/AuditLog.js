const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    actor_id: {
        type: DataTypes.INTEGER,
        
        allowNull: true 
    },
    action: {
        type: DataTypes.ENUM('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'DELETED', 'LOGIN'),
        allowNull: false
    },
    entity_type: {
        type: DataTypes.ENUM('EXPENSE', 'BUDGET', 'USER'),
        allowNull: false
    },
    entity_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    old_values: {
        type: DataTypes.JSON, 
        allowNull: true
    },
    new_values: {
        type: DataTypes.JSON, 
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
    }
}, {
    tableName: 'audit_log', 
    
    // --- TIMESTAMP CONFIGURATION ---
    timestamps: true,
    createdAt: 'created_at', 
    updatedAt: false,        
    
    underscored: true
});

module.exports = AuditLog;