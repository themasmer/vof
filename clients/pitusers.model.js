const { DataTypes } = require('sequelize');
const role = require('../_helpers/role');
// const Pits = require('../clients/pit.model')(sequelize);
// const Role = require('../accounts/role.model')(sequelize);

module.exports = model;

function model(sequelize) {
    const attributes = {
        Id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true },
        pitId: {
            type: DataTypes.UUID, allowNull: false,
            // references: {
            //     model: db.Pits, // 'Movies' would also work
            //     key: 'id',
            // },
        },
        userId: {
            type: DataTypes.UUID, allowNull: false,
            // references: {
            //     model: db.Account, // 'Movies' would also work
            //     key: 'id',
            // }, 
        },
        role:{ type: DataTypes.TINYINT, allowNull: false },
        // createdAt: { type: DataTypes.DATE },
        // updatedAt: { type: DataTypes.DATE },
        createdAt: { type: 'TIMESTAMP',
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
        updatedAt: { type: 'TIMESTAMP',
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        }

    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        // timestamps: false
    };

    return sequelize.define('pitusers', attributes, options);
}