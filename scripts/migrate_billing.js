/**
 * One-off migration: adds the billing columns to the existing `users` table.
 * `server.js` runs `sequelize.sync({ alter: false })`, which creates missing
 * tables but never alters existing ones - new tables (like `payments`) get
 * created automatically on next server start, but `users` already exists
 * and needs these columns added explicitly.
 *
 * Run once with: node scripts/migrate_billing.js
 */
require('dotenv').config();
const db = require('../models');

async function run() {
  const qi = db.sequelize.getQueryInterface();
  const table = await qi.describeTable('users');

  const columns = {
    plan: {
      type: db.Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'free',
    },
    stripe_customer_id: {
      type: db.Sequelize.STRING(60),
      allowNull: true,
    },
    stripe_subscription_id: {
      type: db.Sequelize.STRING(60),
      allowNull: true,
    },
    subscription_status: {
      type: db.Sequelize.STRING(30),
      allowNull: true,
    },
    current_period_end: {
      type: db.Sequelize.DATE,
      allowNull: true,
    },
  };

  for (const [name, definition] of Object.entries(columns)) {
    if (table[name]) {
      console.log(`- users.${name} already exists, skipping`);
      continue;
    }
    await qi.addColumn('users', name, definition);
    console.log(`+ added users.${name}`);
  }

  console.log('Billing migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Billing migration failed:', err);
  process.exit(1);
});
