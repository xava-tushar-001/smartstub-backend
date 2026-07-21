module.exports = function (sequelize, DataTypes) {
  return sequelize.define('payment', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    stripe_invoice_id: {
      type: DataTypes.STRING(60),
      allowNull: true,
      unique: true
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    // amount in the smallest currency unit (e.g. cents)
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'usd'
    },
    // paid | failed | refunded
    status: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'payments',
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
