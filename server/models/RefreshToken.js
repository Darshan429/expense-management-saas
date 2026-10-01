const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RefreshToken = sequelize.define('RefreshToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    token_hash: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true
    },
    expires_at: {
        type: DataTypes.DATE, 
        allowNull: false
    },
    revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    ip_address: {
        type: DataTypes.STRING(45), 
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'refresh_tokens', 
    timestamps: true,
    createdAt: 'created_at', 
    updatedAt: false,        
    underscored: true
});

module.exports = RefreshToken;