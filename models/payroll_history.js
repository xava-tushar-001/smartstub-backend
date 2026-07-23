module.exports = function (sequelize, DataTypes) {
  return sequelize.define('payroll_history', {
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
    // Finch's payroll-run id - combined with finch_individual_id this is the
    // unique identifier Finch uses for a single pay statement.
    finch_payment_id: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    finch_individual_id: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    employee_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    job_title: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // active | leave | onboarding | terminated | etc (per Finch's employment_status enum)
    employment_status: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    pay_period_start: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    pay_period_end: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    pay_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    // all money amounts in the smallest currency unit (cents), matching Finch
    gross_pay: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    net_pay: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    bonus_amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    overtime_amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    // Full earnings line-item array from Finch, kept for detail views
    earnings: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const raw = this.getDataValue('earnings');
        if (typeof raw !== 'string') return raw;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
    }
  }, {
    sequelize,
    tableName: 'payroll_histories',
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
      {
        name: "unique_payroll_record",
        unique: true,
        fields: [
          { name: "user_id" },
          { name: "finch_payment_id" },
          { name: "finch_individual_id" },
        ]
      },
    ]
  });
};
