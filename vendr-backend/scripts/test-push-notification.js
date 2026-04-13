// Test script to send a push notification via Expo Push API
// Usage: node scripts/test-push-notification.js <EXPO_PUSH_TOKEN>

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

async function sendTestPushNotification(pushToken) {
  if (!pushToken) {
    console.error('Usage: node scripts/test-push-notification.js <EXPO_PUSH_TOKEN>');
    console.error('\nTo get your Expo push token:');
    console.error('1. Run your app on a development build (not Expo Go)');
    console.error('2. Add this to your code to log the token:');
    console.error('   const token = await Notifications.getExpoPushTokenAsync({ projectId: process.env.EXPO_PUBLIC_PROJECT_ID });');
    console.error('   console.log("Push token:", token.data);');
    process.exit(1);
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: 'Test Notification',
    body: 'This is a test push notification from Vendr',
    data: { type: 'test', message: 'Hello from the test script!' },
    badge: 1,
  };

  try {
    console.log('Sending test push notification...');
    console.log('Token:', pushToken);
    console.log('Message:', JSON.stringify(message, null, 2));

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error('\n❌ Errors:', result.errors);
    } else {
      console.log('\n✅ Push notification sent successfully!');
    }
  } catch (error) {
    console.error('\n❌ Failed to send push notification:', error);
  }
}

// Get token from command line argument
const pushToken = process.argv[2];
sendTestPushNotification(pushToken);
