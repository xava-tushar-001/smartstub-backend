const mysql = require('mysql2/promise');
const db = require('./models');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const migration_seeders = (async () => {
  try {
    await db.sequelize.sync({ alter: false });
    // await db.sequelize.sync({ alter: true });
    console.log('Database synced successfully');

    const existingUser = await db.users.findOne({ where: { email: process.env.ADMIN_EMAIL } });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS.toString(), saltRounds);

      await db.users.create({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        user_type: 1,
        is_active: 1
      });

      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (err) {
    console.error('Error during migration and seeding:', err);
  }
})();

module.exports = migration_seeders;
