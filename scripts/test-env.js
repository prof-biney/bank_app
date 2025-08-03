// Script to test if environment variables are loaded correctly
console.log('Testing environment variables:');
console.log('----------------------------');

// Check Appwrite configuration
console.log('EXPO_PUBLIC_APPWRITE_ENDPOINT:', process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'Not defined');
console.log('EXPO_PUBLIC_APPWRITE_PROJECT_ID:', process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 'Not defined');
console.log('EXPO_PUBLIC_APPWRITE_PLATFORM:', process.env.EXPO_PUBLIC_APPWRITE_PLATFORM || 'Not defined');
console.log('EXPO_PUBLIC_APPWRITE_DATABASE_ID:', process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'Not defined');
console.log('EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID:', process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID || 'Not defined');

// Check Paystack configuration
console.log('EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY:', 
  process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY 
    ? `${process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY.substring(0, 5)}...` // Show only first 5 chars for security
    : 'Not defined'
);
console.log('EXPO_PUBLIC_PAYSTACK_DEFAULT_EMAIL:', process.env.EXPO_PUBLIC_PAYSTACK_DEFAULT_EMAIL || 'Not defined');
console.log('EXPO_PUBLIC_PAYSTACK_CURRENCY:', process.env.EXPO_PUBLIC_PAYSTACK_CURRENCY || 'Not defined');

// Check application environment
console.log('EXPO_PUBLIC_APP_ENV:', process.env.EXPO_PUBLIC_APP_ENV || 'Not defined');

console.log('----------------------------');
console.log('Note: If variables show as "Not defined", make sure:');
console.log('1. You have a .env file in the project root');
console.log('2. The variable names in the .env file match the ones being checked');
console.log('3. You\'re using the correct prefix (EXPO_PUBLIC_) for client-accessible variables');
console.log('4. You\'re running this script with the environment variables loaded');