// Test script to send a push notification via your backend
// Usage: node scripts/test-push-backend.js <USER_ID>

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:3000';

async function sendTestPushNotification(userId) {
  if (!userId) {
    console.error('Usage: node scripts/test-push-backend.js <USER_ID>');
    console.error('\nTo get your user ID:');
    console.error('1. Log in to your app');
    console.error('2. Check the user object in your auth store or backend logs');
    console.error('3. Or query your database: SELECT id FROM users WHERE email = "your@email.com"');
    process.exit(1);
  }

  try {
    console.log('Sending test push notification via backend...');
    console.log('User ID:', userId);
    console.log('Backend URL:', BASE_URL);

    // First, get the access token (you'll need to provide it or login first)
    // For now, we'll try to call the notification endpoint directly
    // In production, you'd need to authenticate first

    const response = await fetch(`${BASE_URL}/api/notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        title: 'Test Notification',
        body: 'This is a test push notification from Vendr backend',
        type: 'test',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('\n❌ Failed to send notification:', error);
      console.error('\nNote: You need to create a test endpoint in your backend first.');
      console.error('See the notification.service.ts for the createNotification function.');
      process.exit(1);
    }

    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    console.log('\n✅ Test notification sent via backend!');
  } catch (error) {
    console.error('\n❌ Failed to send push notification:', error);
    console.error('\nMake sure your backend is running on:', BASE_URL);
  }
}

// Get user ID from command line argument
const userId = process.argv[2];
sendTestPushNotification(userId);
