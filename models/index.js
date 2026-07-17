'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV
const db = {};

let sequelize;

if (env === 'development') {

  sequelize = new Sequelize(
    process.env.DEV_DATABASE,
    process.env.DEV_USERNAME,
    process.env.DEV_PASSWORD,
    {
      host: process.env.DEV_HOST,
      dialect: 'mysql',
      logging: process.env.LOGGING == 1 ? console.log : false

    }
  );
} else if (env === 'production') {

  sequelize = new Sequelize(
    process.env.PROD_DATABASE,
    process.env.PROD_USERNAME,
    process.env.PROD_PASSWORD,
    {
      host: process.env.PROD_HOST,
      dialect: 'mysql',
      logging: process.env.LOGGING == 1 ? console.log : false

    }
  );
} else {
  sequelize = new Sequelize(
    process.env.DEFAULT_DATABASE,
    process.env.DEFAULT_USERNAME,
    process.env.DEFAULT_PASSWORD,
    {
      host: process.env.DEFAULT_HOST,
      dialect: 'mysql',
      logging: process.env.LOGGING == 1 ? console.log : false
    }
  );
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
