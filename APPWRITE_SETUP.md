# Appwrite Setup Guide

This guide provides detailed instructions for setting up Appwrite for the BankApp React Native application. Following these steps carefully will help you avoid common issues, particularly the "Invalid Origin" error that occurs when platforms are not properly registered.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating an Appwrite Project](#creating-an-appwrite-project)
- [Registering Platforms](#registering-platforms)
  - [Android Platform Registration](#android-platform-registration)
  - [iOS Platform Registration](#ios-platform-registration)
- [Environment Configuration](#environment-configuration)
- [Testing Your Configuration](#testing-your-configuration)
- [Troubleshooting](#troubleshooting)
  - [Invalid Origin Error](#invalid-origin-error)
  - [useInsertionEffect Warning](#useinsertioneffect-warning)

## Prerequisites

Before you begin, ensure you have:

1. An [Appwrite account](https://appwrite.io/) (sign up if you don't have one)
2. Access to the [Appwrite Console](https://cloud.appwrite.io/console)
3. Your React Native application's bundle identifiers:
   - Android: `com.profbiney.vault` (or your custom bundle ID)
   - iOS: `com.profbiney.vault` (or your custom bundle ID)

## Creating an Appwrite Project

1. Log in to the [Appwrite Console](https://cloud.appwrite.io/console)
2. Click on "Create Project"
3. Enter a name for your project (e.g., "BankApp")
4. Click "Create" to create your project
5. Once created, note your **Project ID** from the Project Settings > General page
   - You'll need this for your environment variables

## Registering Platforms

### Android Platform Registration

The "Invalid Origin" error occurs when your Android app attempts to connect to Appwrite, but the platform isn't registered in your Appwrite project. Follow these steps to register your Android platform:

1. In your Appwrite project, navigate to **Project Settings > Platforms**
2. Click on **Add Platform**
3. Select **Android**
4. Enter your application's package name: `com.profbiney.vault` (or your custom bundle ID)
   - This MUST match exactly what's in your `.env` file under `EXPO_PUBLIC_APPWRITE_PLATFORM`
   - The package name is case-sensitive
5. (Optional) Add a name for your platform (e.g., "BankApp Android")
6. Click **Register** to save your platform

![Android Platform Registration](https://appwrite.io/images/docs/sdks/android/add-platform.png)

### iOS Platform Registration

If you're also developing for iOS, you need to register your iOS platform:

1. In your Appwrite project, navigate to **Project Settings > Platforms**
2. Click on **Add Platform**
3. Select **iOS**
4. Enter your application's bundle identifier: `com.profbiney.vault` (or your custom bundle ID)
   - This should match what's in your Expo app.json or your native iOS project
5. (Optional) Add a name for your platform (e.g., "BankApp iOS")
6. Click **Register** to save your platform

## Environment Configuration

After registering your platforms, you need to configure your environment variables:

1. Copy the `.env.example` file to create your own `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Appwrite configuration:
   ```
   # Appwrite Configuration
   EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_actual_project_id
   EXPO_PUBLIC_APPWRITE_PLATFORM=com.profbiney.vault
   EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
   EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID=your_user_collection_id
   ```

   - Replace `your_actual_project_id` with your Appwrite Project ID
   - Ensure `EXPO_PUBLIC_APPWRITE_PLATFORM` matches exactly the package name you registered
   - Replace `your_database_id` and `your_user_collection_id` with your actual IDs

## Testing Your Configuration

To verify that your Appwrite configuration is correct:

1. Run the test script:
   ```bash
   npm run test-appwrite
   # or
   yarn test-appwrite
   ```

2. This script will:
   - Check your Appwrite configuration
   - Attempt to connect to Appwrite
   - Provide specific troubleshooting tips if there are any issues

## Troubleshooting

### Invalid Origin Error

If you encounter this error:
```
[AppwriteException: Invalid Origin. Register your new client (com.profbiney.vault) as a new Android platform on your project console dashboard]
```

This means the platform identifier in your app doesn't match any registered platform in your Appwrite project. To fix this:

1. **Check your platform registration**:
   - Go to your Appwrite dashboard > Project Settings > Platforms
   - Verify that you have registered the Android platform with the exact package name that matches your `.env` file
   - The package name is case-sensitive and must match exactly

2. **Check your environment variables**:
   - Ensure `EXPO_PUBLIC_APPWRITE_PLATFORM` in your `.env` file matches the registered platform
   - Restart your development server after making changes to environment variables

3. **Verify your Appwrite client initialization**:
   - Check that your Appwrite client is properly initialized with the platform:
     ```typescript
     client
       .setEndpoint(appwriteConfig.endpoint)
       .setProject(appwriteConfig.projectId)
       .setPlatform(appwriteConfig.platform);
     ```

### useInsertionEffect Warning

If you encounter this warning:
```
ERROR  Warning: useInsertionEffect must not schedule updates.
```

This warning occurs when you try to schedule state updates during React's `useInsertionEffect` hook, which is not allowed. In the context of our application, this can happen when using `Alert.alert` or other state-updating functions during rendering or effects.

To fix this issue:

1. **Avoid using `Alert.alert` in render phase**:
   - Don't use `Alert.alert` directly in component rendering or in `useInsertionEffect`
   - Move alert calls to event handlers or `useEffect` hooks

2. **Use console.log for errors during rendering**:
   - Replace `Alert.alert` with `console.log` for error reporting during rendering
   - Example:
     ```typescript
     // Instead of:
     // Alert.alert("Error", "Login failed: " + error.message);
     
     // Use:
     console.log("Login error:", error);
     ```

3. **Handle UI updates properly**:
   - Use state management (like our Zustand store) to track errors
   - Then render error messages based on that state
   - This avoids scheduling updates during render

This warning is important to fix because scheduling updates during `useInsertionEffect` can cause render phase updates, which can lead to unexpected behavior and performance issues.

## Additional Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [React Native Appwrite SDK Documentation](https://appwrite.io/docs/sdks/react-native/getting-started)
- [Expo Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)