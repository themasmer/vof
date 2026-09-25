const config = require('config.json');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

module.exports = db = {};

initialize();

async function initialize() {
    // create db if it doesn't already exist
    let { host, port, user, password, database } = config.database;
    host = process.env.DB_HOST || host
    port = process.env.DB_PORT || port
    user = process.env.DB_USER || user
    password = process.env.DB_PASSWORD || password
    database = process.env.DB_DATABASE || database

    console.log(`${database} ${host} ${password}`)
    const connection = await mysql.createConnection({
          host: host,
          port : port,
          user: user,
          password: password
        });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);

    // connect to db
    global.sequelize = new Sequelize(database, user, password, {
        host: host,
        port: port,
        dialect: 'mysql', 
        retry: {
            match: [/Deadlock/i],
            max: 3, // Maximum rety 3 times
            backoffBase: 1000, // Initial backoff duration in ms. Default: 100,
            backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
        },
      },
    );

    // init models and add them to the exported db object
    db.Account = require('../accounts/account.model')(sequelize);
    db.RefreshToken = require('../accounts/refresh-token.model')(sequelize);
    db.Audits = require('../clients/audits.model')(sequelize);
    db.Pits = require('../clients/pit.model')(sequelize);
    db.Role = require('../accounts/role.model')(sequelize);
    db.PitUsers = require('../clients/pitusers.model')(sequelize);

    // define relationships
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);

    db.Account.hasMany(db.PitUsers, {foreignKey: 'userId', sourceKey: 'UserId'}, { onDelete: 'CASCADE' });
    db.PitUsers.belongsTo(db.Account, { foreignKey: "userId", targetKey:'UserId' });

    db.Pits.hasMany(db.PitUsers, {foreignKey: 'pitId', sourceKey: 'PitID'}, { onDelete: 'CASCADE' });
    db.PitUsers.belongsTo(db.Pits, { foreignKey: "pitId", targetKey:'PitID' });

    // sync all models with database
    await sequelize.sync();
}
