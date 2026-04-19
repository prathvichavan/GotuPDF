import { neon } from '@neondatabase/serverless';

// Helper to get safe SQL connection
const getSql = () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    return neon(process.env.DATABASE_URL);
};

export interface ContactMessage {
    id: number;
    name: string;
    email: string;
    subject: string;
    message: string;
    ip_address: string | null;
    created_at: Date;
}

export async function saveContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
    ip_address?: string;
}): Promise<ContactMessage> {
    // Initialize connection request-time (safe)
    const sql = getSql();

    try {
        const result = await sql`
      INSERT INTO contact_messages (name, email, subject, message, ip_address)
      VALUES (${data.name}, ${data.email}, ${data.subject}, ${data.message}, ${data.ip_address || null})
      RETURNING *
    `;
        return result[0] as ContactMessage;
    } catch (error) {
        console.error('Database Error in saveContactMessage:', error);
        throw error;
    }
}
