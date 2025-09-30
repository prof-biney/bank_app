# Manual Biometric Collections Setup

Since the Appwrite Client SDK doesn't include collection creation functions, you'll need to create the biometric collections manually through the Appwrite Console. Follow these steps:

## Step 1: Access Appwrite Console

1. Go to your Appwrite Console at [https://cloud.appwrite.io](https://cloud.appwrite.io)
2. Navigate to your project: **687e11300022c06f9c64**
3. Go to **Databases** → **Your Database** (`688951e80021396d424f`)

## Step 2: Create Biometric Tokens Collection

### Collection Settings:
- **Collection ID**: `biometric_tokens`
- **Collection Name**: `Biometric Tokens`

### Attributes to Create:

| Attribute Key | Type | Size | Required | Default |
|---------------|------|------|----------|---------|
| `token` | String | 255 | ✓ | - |
| `userId` | String | 36 | ✓ | - |
| `deviceId` | String | 100 | ✓ | - |
| `biometricType` | String | 20 | ✓ | - |
| `createdAt` | DateTime | - | ✓ | - |
| `expiresAt` | DateTime | - | ✓ | - |
| `lastUsedAt` | DateTime | - | ✗ | - |
| `isActive` | Boolean | - | ✓ | `true` |

### Indexes to Create:

1. **token_unique** (Unique Index)
   - Attributes: `token`
   - Type: Unique
   
2. **user_device** (Key Index)
   - Attributes: `userId`, `deviceId`
   - Type: Key
   
3. **isActive** (Key Index)
   - Attributes: `isActive`
   - Type: Key
   
4. **expiresAt** (Key Index)
   - Attributes: `expiresAt`
   - Type: Key

### Permissions:
Set the following permissions for the collection:

**Create Documents**: `users`
**Read Documents**: `users`
**Update Documents**: `users`
**Delete Documents**: `users`

## Step 3: Create Biometric Audit Collection

### Collection Settings:
- **Collection ID**: `biometric_audit`
- **Collection Name**: `Biometric Audit Log`

### Attributes to Create:

| Attribute Key | Type | Size | Required | Default |
|---------------|------|------|----------|---------|
| `userId` | String | 36 | ✓ | - |
| `action` | String | 20 | ✓ | - |
| `biometricType` | String | 20 | ✓ | - |
| `deviceId` | String | 100 | ✓ | - |
| `success` | Boolean | - | ✓ | - |
| `errorMessage` | String | 500 | ✗ | - |
| `timestamp` | DateTime | - | ✓ | - |
| `userAgent` | String | 255 | ✗ | - |

### Indexes to Create:

1. **userId** (Key Index)
   - Attributes: `userId`
   - Type: Key
   
2. **timestamp** (Key Index)
   - Attributes: `timestamp`
   - Type: Key
   
3. **action** (Key Index)
   - Attributes: `action`
   - Type: Key
   
4. **success** (Key Index)
   - Attributes: `success`
   - Type: Key

### Permissions:
Set the following permissions for the collection (audit logs are read-only after creation):

**Create Documents**: `users`
**Read Documents**: `users`
**Update Documents**: (none - audit logs are immutable)
**Delete Documents**: (none - audit logs are permanent)

## Step 4: Update Users Collection

Navigate to your existing **users** collection (`688a76c0003178d28a3e`) and add this attribute:

### New Attribute:
| Attribute Key | Type | Size | Required | Default |
|---------------|------|------|----------|---------|
| `biometricPreferences` | String | 2000 | ✗ | `{}` |

This will store the user's biometric preferences as a JSON string.

## Step 5: Verify Setup

Once you've created both collections and updated the users collection, you can run the verification test:

```bash
npm run biometric:verify
```

This should now show that both collections exist and are accessible.

## Security Notes

### Biometric Tokens Collection Security Rules:
The permissions ensure that:
- Users can only create tokens for themselves
- Users can only read their own tokens
- Users can only update their own tokens
- Users can only delete their own tokens

### Biometric Audit Collection Security Rules:
The permissions ensure that:
- Users can create audit logs for themselves
- Users can read their own audit logs
- Audit logs cannot be modified (immutable)
- Audit logs cannot be deleted (permanent record)

## Environment Variables (Optional)

After setup, you can add these to your `.env` file for explicit collection references:

```env
EXPO_PUBLIC_APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID=biometric_tokens
EXPO_PUBLIC_APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID=biometric_audit
```

The app will work without these since it uses fallback collection IDs, but adding them makes the configuration explicit.

## Troubleshooting

### Collection Creation Issues:
- Ensure you have admin permissions on the project
- Make sure you're in the correct database
- Verify all attribute types and sizes are correct
- Check that all required attributes are marked as required

### Permission Issues:
- Verify that the permissions are set to `users` role
- Ensure the collection has the correct read/write permissions
- Check that users are properly authenticated before accessing collections

### Index Creation Issues:
- Wait for attributes to be fully created before adding indexes
- Ensure index names are unique within the collection
- Verify that indexed attributes exist and are available

## Next Steps

After successful setup:

1. **Test Authentication**: Users can now set up biometric authentication
2. **Monitor Audit Logs**: Check the audit collection for authentication attempts
3. **Token Management**: Tokens will automatically expire after 7 days
4. **Security**: All biometric operations are logged and secured