# Appwrite Server Configuration Guide

This guide will help you configure your Appwrite server to fix the permission and authentication issues.

## Current Issues to Fix

1. **Authentication Scope Error**: `User (role: guests) missing scopes (["account"])`
2. **Database Access Error**: `The current user is not authorized to perform the requested action`

## Step-by-Step Configuration

### 1. Configure Authentication Settings

#### A. Enable Email/Password Authentication
1. Go to your Appwrite Console
2. Navigate to **Auth** → **Settings**
3. Ensure **Email/Password** authentication is enabled
4. Set **Session Length** to desired duration (e.g., 365 days)

#### B. Configure User Registration
1. In **Auth** → **Settings**
2. Enable **User Registration**
3. Set **Email Verification** as optional (for development)

### 2. Configure Database Permissions

#### A. Database Settings
1. Go to **Databases** → Your Database
2. Click on **Settings**
3. Set **Permissions** to allow authenticated users:
   ```
   Role: users
   Permissions: create, read, update, delete
   ```

#### B. Collection Permissions

For each collection, configure the following permissions:

##### **Users Collection** (`${APPWRITE_USER_COLLECTION_ID}`)
```
Permissions:
- Role: users
  - Create: ✓ (allow users to create their profile)
  - Read: ✓ (allow users to read their profile)  
  - Update: ✓ (allow users to update their profile)
  - Delete: ✓ (allow users to delete their profile)

- Role: user:[USER_ID] (Document-level security)
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓
```

##### **Cards Collection** (`${APPWRITE_CARDS_COLLECTION_ID}`)
```
Permissions:
- Role: users
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓

Document-level permissions (recommended):
- Role: user:[USER_ID]
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓
```

##### **Transactions Collection** (`${APPWRITE_TRANSACTIONS_COLLECTION_ID}`)
```
Permissions:
- Role: users
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓

Document-level permissions (recommended):
- Role: user:[USER_ID]
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓
```

##### **Notifications Collection** (`${APPWRITE_NOTIFICATIONS_COLLECTION_ID}`)
```
Permissions:
- Role: users
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓

Document-level permissions (recommended):
- Role: user:[USER_ID]
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓
```

##### **Account Updates Collection** (`account_updates`)
```
Permissions:
- Role: users
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓

Document-level permissions (recommended):
- Role: user:[USER_ID]
  - Create: ✓
  - Read: ✓
  - Update: ✓
  - Delete: ✓
```

### 3. Configure Storage Permissions (if using file uploads)

1. Go to **Storage** → Your Bucket
2. Set **Permissions**:
   ```
   Role: users
   - Create: ✓
   - Read: ✓
   - Update: ✓
   - Delete: ✓
   ```

### 4. Configure API Keys (if needed)

1. Go to **Overview** → **Integrate**
2. Create an API Key with appropriate scopes:
   ```
   Scopes:
   - sessions.write
   - users.read
   - users.write
   - databases.read
   - databases.write
   ```

## Environment Variables to Verify

Make sure your `.env` file contains all the correct values:

```env
# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id

# Collection IDs
EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID=your_users_collection_id
EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID=your_cards_collection_id
EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID=your_transactions_collection_id
EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID=your_notifications_collection_id

# Platform identifier
EXPO_PUBLIC_APPWRITE_PLATFORM=com.profbiney.vault

# Storage (if using file uploads)
EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID=your_bucket_id
```

## Quick Fix Commands

You can also configure permissions via Appwrite CLI:

### Install Appwrite CLI
```bash
npm install -g appwrite-cli
```

### Login to Appwrite
```bash
appwrite login
```

### Set Database Permissions
```bash
# Set database permissions
appwrite databases updatePermissions \
    --databaseId="your_database_id" \
    --permissions='["read(\"users\")", "write(\"users\")"]'

# Set collection permissions for each collection
appwrite databases updateCollectionPermissions \
    --databaseId="your_database_id" \
    --collectionId="your_users_collection_id" \
    --permissions='["read(\"users\")", "write(\"users\")"]'
```

## Testing the Configuration

After making these changes:

1. **Restart your app**: `bun start -c`
2. **Test authentication**: Try signing up/signing in
3. **Test data access**: Check if transactions load without errors

## Common Issues and Solutions

### Issue: "User (role: guests) missing scopes"
**Solution**: Ensure the user is properly authenticated and has the "users" role

### Issue: "Not authorized to perform action"  
**Solution**: Check collection permissions and ensure users have appropriate read/write access

### Issue: "Invalid credentials"
**Solution**: Verify email/password authentication is enabled and credentials are correct

## Security Best Practices

1. **Use document-level permissions** for sensitive data
2. **Limit API key scopes** to only what's necessary
3. **Enable email verification** in production
4. **Set appropriate session lengths**
5. **Use HTTPS** for all endpoints

## Next Steps

After configuration:
1. Test user registration
2. Test user login
3. Test data operations (cards, transactions, etc.)
4. Set up proper validation rules for your collections
5. Configure real-time subscriptions if needed

## Support

If you continue to have issues:
1. Check Appwrite logs in the console
2. Verify all environment variables are correct
3. Test with a fresh user account
4. Check network connectivity to Appwrite endpoints