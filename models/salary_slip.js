module.exports = function (sequelize, DataTypes) {
  return sequelize.define('salary_slip', {
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
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    file_data: {
      type: DataTypes.BLOB('long'),
      allowNull: false
    },
    // processing | completed | failed
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'processing'
    },
    // green | orange | red - worst status among all checks
    overall_status: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // [{ name, status: 'pass' | 'warning' | 'error', message }]
    checks: {
      type: DataTypes.JSON,
      allowNull: true
    },
    pass_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    warning_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    error_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'salary_slips',
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
