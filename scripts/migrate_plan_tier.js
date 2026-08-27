/**
 * One-off migration: adds the `plan_tier` column to the existing `users`
 * table. `server.js` runs `sequelize.sync({ alter: false })`, which never
 * alters existing tables, so this column needs to be added explicitly.
 *
 * Run once with: node scripts/migrate_plan_tier.js
 */
require('dotenv').config();
const db = require('../models');

async function run() {
  const qi = db.sequelize.getQueryInterface();
  const table = await qi.describeTable('users');

  if (table.plan_tier) {
    console.log('- users.plan_tier already exists, skipping');
  } else {
    await qi.addColumn('users', 'plan_tier', {
      type: db.Sequelize.STRING(10),
      allowNull: true,
    });
    console.log('+ added users.plan_tier');
  }

  console.log('Plan tier migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Plan tier migration failed:', err);
  process.exit(1);
});
