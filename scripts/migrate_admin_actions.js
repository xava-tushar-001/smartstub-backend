/**
 * One-off migration: adds the columns needed for admin account-management
 * actions (suspend/reactivate/delete/plan override), the Plan Selection
 * screen, Finch connection-health monitoring, and salary-slip manual
 * correction. Same pattern as scripts/migrate_billing.js - `server.js` runs
 * `sequelize.sync({ alter: false })`, which never alters existing tables.
 *
 * Run once with: node scripts/migrate_admin_actions.js
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

  const usersTableBefore = await qi.describeTable('users');
  const planSelectedIsNew = !usersTableBefore.plan_selected;

  await addMissingColumns(qi, 'users', {
    status: {
      type: db.Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    plan_selected: {
      type: db.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  // Only backfill on the run that actually introduces the column - existing
  // accounts have already made their plan choice implicitly (they're already
  // using the product), so don't route them back through onboarding. New
  // signups after this point keep the real default of false.
  if (planSelectedIsNew) {
    const [, affected] = await db.sequelize.query(
      "UPDATE users SET plan_selected = 1 WHERE createdAt < NOW()"
    );
    console.log('+ backfilled plan_selected = true for existing users');
  }

  await addMissingColumns(qi, 'payroll_connections', {
    reauth_required: {
      type: db.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  await addMissingColumns(qi, 'salary_slips', {
    admin_overridden: {
      type: db.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    admin_reviewed_at: {
      type: db.Sequelize.DATE,
      allowNull: true,
    },
    admin_note: {
      type: db.Sequelize.TEXT,
      allowNull: true,
    },
  });

  console.log('Admin-actions migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Admin-actions migration failed:', err);
  process.exit(1);
});
