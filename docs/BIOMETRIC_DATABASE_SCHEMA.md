# Biometric Authentication Database Schema

This document describes the database collections required for biometric authentication functionality.

## Collections Overview

### 1. `biometric_tokens` Collection

Stores server-side biometric token data for validation and security.

**Collection ID:** `biometric_tokens`
**Purpose:** Server-side validation of biometric authentication tokens

#### Attributes:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | String | Yes | The biometric token (matches local storage) |
| `userId` | String | Yes | Reference to the user who owns this token |
| `deviceId` | String | Yes | Unique identifier for the user's device |
| `biometricType` | String | Yes | Type of biometric: 'faceId', 'touchId', or 'fingerprint' |
| `createdAt` | DateTime | Yes | When the token was created |
| `expiresAt` | DateTime | Yes | When the token expires (7 days from creation) |
| `lastUsedAt` | DateTime | No | Last time this token was used for authentication |
| `isActive` | Boolean | Yes | Whether the token is active (default: true) |

#### Indexes:

- `token` (unique)
- `userId + deviceId` (compound)
- `isActive`
- `expiresAt`

#### Security Rules:

```javascript
// Create: Only authenticated users can create tokens for themselves
(user != null) && (user.$id == data.userId)

// Read: Only the token owner can read their tokens
(user != null) && (user.$id == data.userId)

// Update: Only the token owner can update their tokens
(user != null) && (user.$id == data.userId)

// Delete: Only the token owner can delete their tokens
(user != null) && (user.$id == data.userId)
```

### 2. `biometric_audit` Collection

Audit log for biometric authentication attempts and activities.

**Collection ID:** `biometric_audit`
**Purpose:** Security audit trail for biometric operations

#### Attributes:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | String | Yes | Reference to the user |
| `action` | String | Yes | Action type: 'setup', 'login', 'failure', 'revoke' |
| `biometricType` | String | Yes | Type of biometric used |
| `deviceId` | String | Yes | Device identifier |
| `success` | Boolean | Yes | Whether the action was successful |
| `errorMessage` | String | No | Error message if action failed |
| `timestamp` | DateTime | Yes | When the action occurred |
| `userAgent` | String | No | User agent string (future enhancement) |

#### Indexes:

- `userId`
- `timestamp`
- `action`
- `success`

#### Security Rules:

```javascript
// Create: Only authenticated users can create audit logs for themselves
(user != null) && (user.$id == data.userId)

// Read: Only the user can read their own audit logs
(user != null) && (user.$id == data.userId)

// Update: Audit logs are immutable
false

// Delete: Audit logs cannot be deleted by users
false
```

### 3. Updated `users` Collection

The existing users collection needs to be extended with biometric preferences.

#### Additional Attributes:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `biometricPreferences` | Object | No | User's biometric authentication preferences |

#### Biometric Preferences Object Structure:

```json
{
  "enabled": false,
  "biometricType": null,
  "enrolledAt": "2024-01-01T00:00:00.000Z",
  "lastUsedAt": "2024-01-01T00:00:00.000Z",
  "deviceId": "device_123456789_abc123def"
}
```

## Database Setup Instructions

### 1. Create Collections

1. Go to your Appwrite Console
2. Navigate to Databases → [Your Database]
3. Create the following collections:

#### `biometric_tokens` Collection:
- Collection ID: `biometric_tokens`
- Create attributes as specified above
- Set up indexes for performance
- Configure security rules

#### `biometric_audit` Collection:
- Collection ID: `biometric_audit`
- Create attributes as specified above
- Set up indexes for performance
- Configure security rules (read-only after creation)

### 2. Update Environment Variables

Add the following environment variables to your `.env` file:

```env
# Biometric Collections (optional - will use defaults if not set)
EXPO_PUBLIC_APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID=biometric_tokens
EXPO_PUBLIC_APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID=biometric_audit
```

### 3. Update User Collection

Add the `biometricPreferences` attribute to your existing `users` collection:
- Type: Object
- Required: No
- Default: `{}`

## Data Flow

### Setup Flow:
1. User enables biometric authentication
2. Local biometric token generated and stored securely
3. Server token created in `biometric_tokens` collection
4. User preferences updated in `users` collection
5. Setup action logged in `biometric_audit` collection

### Authentication Flow:
1. User attempts biometric authentication
2. Local biometric authentication succeeds
3. Local token validated against server token
4. Server token validated (not expired, belongs to user/device)
5. Token refresh if needed (within 24 hours of expiry)
6. Login action logged in audit trail

### Security Features:
- **Token Expiration**: 7-day automatic expiry
- **Device Binding**: Tokens tied to specific devices
- **Audit Trail**: All actions logged for security monitoring
- **Automatic Cleanup**: Expired tokens marked inactive
- **Server Validation**: Prevents local token tampering

## Migration Notes

If you have existing users, the biometric functionality will be:
- **Disabled by default** for all existing users
- **Optional setup** through settings or signup flow
- **Backwards compatible** - no impact on existing authentication

The system gracefully handles:
- Missing biometric collections (fallback to local-only)
- Server connectivity issues (local validation continues)
- Token synchronization problems (re-setup available)