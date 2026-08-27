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
    // active | suspended - separate from is_active (email verification) and
    // is_deleted (account removal), set by an admin via the user management panel.
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active'
    },
    // Reason an admin gave when suspending this account (via the suspend
    // modal). Cleared on reactivation since it only describes the current
    // suspension, not a history of past ones.
    suspend_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Whether the user has been through the post-verification Plan Selection
    // screen. Free/Pro is already tracked on `plan` - this just tracks whether
    // that choice was ever presented, so the frontend knows to route new
    // accounts through onboarding exactly once.
    plan_selected: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // free | paid
    plan: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'free'
    },
    // Which paid duration tier the user picked/subscribed to: monthly | 6month | 1year.
    // Null when plan is 'free'. Set on /select-plan (intent) and confirmed/corrected
    // by the Stripe webhook once the subscription's actual price is known.
    plan_tier: {
      type: DataTypes.STRING(10),
      allowNull: true
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
    },
    // Start of the current billing period - used to scope the Pro plan's
    // "10 additional uploads" quota to the subscription period (not a
    // calendar month), so a renewal grants a fresh 10 rather than resetting
    // on the 1st of the next calendar month.
    current_period_start: {
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
