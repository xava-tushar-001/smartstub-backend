/**
 * One-off migration: adds the `suspend_reason` column to `users`, needed so
 * an admin's suspend-modal reason can be stored and later shown back on the
 * user-detail page. Same pattern as scripts/migrate_admin_actions.js -
 * `server.js` runs `sequelize.sync({ alter: false })`, which never alters
 * existing tables.
 *
 * Run once with: node scripts/migrate_suspend_reason.js
 */
require('dotenv').config();
const db = require('../models');

async function addMissingColumns(qi, tableName, columns) {
  const table = await qi.describeTable(tableName);
  for (const [name, definition] of Object.entries(columns)) {
    if (table[name]) {
      console.log(`- ${tableName}.${name} already exists, skipping`);
      continue;
    }
    await qi.addColumn(tableName, name, definition);
    console.log(`+ added ${tableName}.${name}`);
  }
}

async function run() {
  const qi = db.sequelize.getQueryInterface();

  await addMissingColumns(qi, 'users', {
    suspend_reason: {
      type: db.Sequelize.TEXT,
      allowNull: true,
    },
  });

  console.log('Suspend-reason migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Suspend-reason migration failed:', err);
  process.exit(1);
});
