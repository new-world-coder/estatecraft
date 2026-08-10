import path from 'path';
import dotenv from 'dotenv';

// Load root .env then package-local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

async function main() {
  console.log('Starting database migration...');

  try {
    const { execSync } = require('child_process');

    console.log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Production / CI: apply committed migrations
    // Local schema iteration: use `npm run migrate:dev` instead
    console.log('Applying migrations (prisma migrate deploy)...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
