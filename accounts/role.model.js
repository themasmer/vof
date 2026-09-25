const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
              role: { type: DataTypes.STRING }
       
    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false
    };

    return sequelize.define('role', attributes, options);
}



