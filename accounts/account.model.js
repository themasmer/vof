const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id :{type: DataTypes.BIGINT, primaryKey: true,  allowNull: false, autoIncrement : true},
        UserId: { type: DataTypes.UUID, allowNull: false, default: DataTypes.UUIDV4, unique: true },
        firstName: { type: DataTypes.STRING, allowNull: false },
        lastName: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        phone :  {type: DataTypes.STRING},
        passwordHash: { type: DataTypes.STRING, allowNull: false },
        acceptTerms: { type: DataTypes.BOOLEAN },
        role: { type: DataTypes.INTEGER, allowNull: false },
        verificationToken: { type: DataTypes.STRING },
        verified: { type: DataTypes.DATE },
        resetToken: { type: DataTypes.STRING },
        resetTokenExpires: { type: DataTypes.DATE },
        passwordReset: { type: DataTypes.DATE },
        isActive: {type: DataTypes.BOOLEAN, defaultValue: 1},
        otp: { type: DataTypes.STRING },
        otpCreatedon: { type: 'TIMESTAMP' },
        createdAt: { type: 'TIMESTAMP',
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
        updatedAt: { type: 'TIMESTAMP'
            , defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            , allowNull: false
        },
        isVerified: {
            type: DataTypes.VIRTUAL,
            get() { return !!(!this.verificationToken && (this.verified || this.passwordReset)); }
        },
        resetToken: { type: DataTypes.STRING },
        sessionHash: { type: DataTypes.STRING },
        failedAttempts:{ type: DataTypes.INTEGER}
    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false, 
        defaultScope: {
            // exclude password hash by default
            attributes: { exclude: ['passwordHash'] }
        },
        scopes: {
            // include hash with this scope
            withHash: { attributes: {}, }
        },
        indexes: [
            {
                name: 'INDEX_USER_EMAIL',
                fields: ['email'],
                unique: true,
            }
        ]
    };

    return sequelize.define('account', attributes, options);
}
