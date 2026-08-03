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
    // MariaDB stores JSON as LONGTEXT (no native JSON type), so on write
    // Sequelize's own JSON serialization already handles it correctly, but
    // on read the driver hands back the raw unparsed string - parse it here.
    checks: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const raw = this.getDataValue('checks');
        if (typeof raw !== 'string') return raw;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
    },
    // { gross_pay, net_pay, tax_deduction, other: [{ label, value }] }
    salary_details: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const raw = this.getDataValue('salary_details');
        if (typeof raw !== 'string') return raw;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
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
    },
    // Set when an admin has hand-edited the checks/overall_status/summary
    // below via the manual-correction interface, as opposed to the stored
    // result being straight from Gemini.
    admin_overridden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    admin_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    admin_note: {
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
