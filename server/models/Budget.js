const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Budget = sequelize.define('Budget',{
    id:{
        type:DataTypes.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    department_id:{
        type:DataTypes.INTEGER,
        allowNull:false,
        unique:true
        
    },
    allocated_amount:{
        type:DataTypes.INTEGER,
        allowNull:false
    },
    period:{
        type:DataTypes.DATEONLY,
        allowNull:false
    },
alert_80_sent: {
        type: DataTypes.BOOLEAN, // Sequelize maps this to tinyint(1) in MySQL
        allowNull: false,
        defaultValue: false
    },
    alert_100_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }},
    {
        tablename:'Budgets',
        timestamps:true,
        underscored:true
    });

module.exports = Budget;