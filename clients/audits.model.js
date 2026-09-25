const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        Id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true },
        tableName: { type: DataTypes.STRING(10), allowNull: false },
        message: { type: DataTypes.STRING(1000), allowNull: false },
        UserId: { type: DataTypes.UUID, allowNull: false, default: DataTypes.UUIDV4 },
	ipaddress: { type: DataTypes.STRING(20), allowNull: true },
        createdAt: {
            type: 'TIMESTAMP',
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false
    };

    return sequelize.define('audits', attributes, options);
}
