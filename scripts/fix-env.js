const fs = require('fs');
const content = `DATABASE_URL=postgresql://neondb_owner:npg_lgje5ONYy0iu@ep-red-moon-ahh81d8j-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=krishanmohankumar9311@gmail.com
SMTP_PASSWORD="cjyv wizf nugo oqan"
`;
fs.writeFileSync('.env.local', content, 'utf8');
console.log('✅ .env.local fixed with UTF-8 encoding');
