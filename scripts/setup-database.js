const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lgje5ONYy0iu@ep-red-moon-ahh81d8j-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function setupDatabase() {
    console.log('🔧 Setting up database...');

    const sql = neon(DATABASE_URL);

    try {
        // Create contact_messages table
        await sql`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
        console.log('✅ Table "contact_messages" created successfully');

        // Create indexes
        await sql`
      CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at DESC)
    `;
        console.log('✅ Index "idx_contact_created_at" created');

        await sql`
      CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_messages(email)
    `;
        console.log('✅ Index "idx_contact_email" created');

        console.log('\n✨ Database setup complete!');
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();
