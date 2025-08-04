// Script to test Appwrite connection and configuration
console.log('Testing Appwrite Connection:');
console.log('----------------------------');

// Import required modules
const { Client, Account } = require('react-native-appwrite');

// Create a client
const client = new Client();

// Get configuration from environment variables with fallbacks
const appwriteEndpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const appwriteProjectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 'your_project_id';
const appwritePlatform = process.env.EXPO_PUBLIC_APPWRITE_PLATFORM || 'com.profbiney.vault';

// Configure the client
client
  .setEndpoint(appwriteEndpoint)
  .setProject(appwriteProjectId)
  .setPlatform(appwritePlatform);

// Create an account instance
const account = new Account(client);

// Test the connection
async function testConnection() {
  try {
    console.log('Appwrite Configuration:');
    console.log(`Endpoint: ${appwriteEndpoint}`);
    console.log(`Project ID: ${appwriteProjectId}`);
    console.log(`Platform: ${appwritePlatform}`);
    console.log('\nAttempting to connect to Appwrite...');
    
    // Try to get the account preferences (this will fail if the connection is not working)
    // but it's a lightweight call that doesn't require authentication
    await account.getPrefs();
    
    console.log('\n✅ Successfully connected to Appwrite!');
    console.log('Your Appwrite configuration is correct.');
  } catch (error) {
    console.log('\n❌ Failed to connect to Appwrite');
    console.log(`Error: ${error.message}`);
    console.log('\nTroubleshooting tips:');
    
    if (error.message.includes('Project with the requested ID could not be found')) {
      console.log('1. Check that your EXPO_PUBLIC_APPWRITE_PROJECT_ID is correct');
      console.log('2. Make sure you\'ve copied the Project ID from your Appwrite dashboard');
      console.log('3. Verify there are no extra spaces or characters in the ID');
    } 
    else if (error.message.includes('Invalid Origin')) {
      console.log('1. You need to register your platform in the Appwrite dashboard');
      console.log('2. Go to: Appwrite Dashboard > Project Settings > Platforms > Add Platform > Android');
      console.log(`3. Enter the package name: ${appwritePlatform}`);
      console.log('4. Make sure the package name matches exactly what\'s in your .env file');
    }
    else {
      console.log('1. Check that your EXPO_PUBLIC_APPWRITE_ENDPOINT is correct');
      console.log('2. Verify your internet connection');
      console.log('3. Make sure your Appwrite instance is running and accessible');
    }
  }
  console.log('\n----------------------------');
}

// Run the test
testConnection();