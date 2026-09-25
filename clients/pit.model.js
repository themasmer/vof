const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        Id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true },
        PitID: { type: DataTypes.UUID, allowNull: false, unique: true },
        pitName: { type: DataTypes.STRING, allowNull: false, unique: true },       
        isActive: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
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
        indexes: [
            {
                name: 'INDEX_PITS_NAME',
                fields: ['pitName'],
                unique: true,
            }
        ]
    };

    return sequelize.define('pits', attributes, options);
}