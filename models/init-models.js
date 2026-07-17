var DataTypes = require("sequelize").DataTypes;
var _subscriber = require("./subscriber");

function initModels(sequelize) {
  var subscriber = _subscriber(sequelize, DataTypes);


  return {
    subscriber,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
