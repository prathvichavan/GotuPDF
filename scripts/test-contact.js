
async function testContactAPI() {
    try {
        console.log('Testing Contact API on Port 3001...');
        const response = await fetch('http://localhost:3001/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Bot',
                email: 'test@example.com',
                subject: 'API Health Check',
                message: 'Checking if the API is responsive.'
            })
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log('Status Code:', response.status);
            console.log('✅ API Success:', data);
        } catch (e) {
            console.log('⚠️ API Returned HTML (likely Error):', response.status);
            console.log('--- PREVIEW ---');
            console.log(text.substring(0, 500));
            console.log('--- END PREVIEW ---');
        }
    } catch (error) {
        console.error('❌ Connection Failed:', error.message);
    }
}

testContactAPI();
