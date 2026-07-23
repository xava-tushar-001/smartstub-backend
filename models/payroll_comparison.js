module.exports = function (sequelize, DataTypes) {
  return sequelize.define('payroll_comparison', {
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
    connection_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    previous_payroll_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    current_payroll_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    gross_change: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // increase | decrease | unchanged
    gross_direction: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'unchanged'
    },
    net_change: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    net_direction: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'unchanged'
    },
    bonus_change: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    bonus_direction: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'unchanged'
    },
    overtime_change: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    overtime_direction: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'unchanged'
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'payroll_comparisons',
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
