const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('users', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(90),
      allowNull: true
    },
    about: {
      type: DataTypes.STRING(180),
      allowNull: true
    },
    otp_exp_time: {
      type: DataTypes.STRING(16),
      allowNull: true
    },
    otp: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_type: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    image: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    is_active: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    is_deleted: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    // free | paid
    plan: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'free'
    },
    stripe_customer_id: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    // Stripe subscription status: active | trialing | past_due | canceled | incomplete | unpaid, etc.
    subscription_status: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
};
