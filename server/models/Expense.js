const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

const Expense = sequelize.define('Expense',{
	id:{
		type:DataTypes.INTEGER,
		autoIncrement:true,
		primaryKey:true
	},
	user_id:{
		type:DataTypes.INTEGER,
		allowNull:false
	},
	department_id:{
		type:DataTypes.INTEGER,
		allowNull:false
	},
	amount:{
		type:DataTypes.DECIMAL(12,2),
		allowNull:false
	},
	category:{
		type:DataTypes.ENUM('TRAVEL', 'MEALS', 'SOFTWARE', 'OFFICE', 'OTHER'),
		allowNull:false,
	},
	description: {
        	type: DataTypes.TEXT,
        	allowNull: true
    	},
    	receipt_url: {
        	type: DataTypes.STRING(500),
        	allowNull: true
    	},
	status:{
		type:DataTypes.ENUM('PENDING','APPROVED','REJECTED'),
		allowNull:false,
		defaultValue:'PENDING'
	}},
	{
		tableName:'expenses',
		timestamps:true,
		underscored:true,
		paranoid:true
	}
);

module.exports=Expense;







		

