module.exports = function (sequelize, DataTypes) {
  return sequelize.define('payroll_connection', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    provider: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    finch_account_id: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    // Encrypted (AES-256-GCM via helper/crypto.js) - never stored or logged in plaintext
    finch_token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // active | disconnected
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active'
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'payroll_connections',
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
