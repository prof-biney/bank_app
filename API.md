# BankApp API Documentation

This document provides comprehensive documentation for the BankApp API, including authentication methods, database operations, and data models.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Configuration](#configuration)

## Overview

BankApp uses Firebase as its backend service for authentication, database operations, and file storage. The application supports both development and production environments with proper security rules and data validation.

## Authentication

### Configuration

Authentication is configured in `lib/firebase.ts`:

```typescript
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
initializeApp(firebaseConfig);
## Authentication

### Configuration

Authentication and Firestore access are configured in `lib/firebase.ts`. The Firebase modular SDK (v9+) is used on the client; configuration values are read from environment variables. See the project README for examples and local setup.

Required environment variables (Expo/public):

- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID
- EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)

The typical client flow is:

1. Create an auth user with Email/Password using `createUserWithEmailAndPassword(auth, email, password)`.
2. Persist user profile data to Firestore with `setDoc(doc(firestore, 'users', uid), { name, email, createdAt, ... })`.
3. On sign-in use `signInWithEmailAndPassword(auth, email, password)` and then read the user's Firestore document with `getDoc`.
4. Use `getIdToken()` (from Firebase Auth) when the app needs to call authenticated server endpoints.

The project's `lib/firebase.ts` exposes helpers such as `createUser`, `signIn`, `signOut`, `getCurrentUser`, and `onAuthChange` which wrap these operations. Refer to that file for concrete implementations used across the app.
    setUser(mockUser);
    return true;
  } catch (error) {
    console.error("Sign in error:", error);
    return false;
  }
};

const signUp = async (
  name: string,
  email: string,
  password: string
): Promise<boolean> => {
  try {
    // Mock authentication - replace with Appwrite auth
    const mockUser: User = {
      id: "1",
      email,
      name,
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("user", JSON.stringify(mockUser));
    setUser(mockUser);
    return true;
  } catch (error) {
    console.error("Sign up error:", error);
    return false;
  }
};

const signOut = async () => {
  try {
    await AsyncStorage.removeItem("user");
    setUser(null);
  } catch (error) {
    console.error("Sign out error:", error);
  }
};
```

## Data Models

### User

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
```

### Card

```typescript
export interface Card {
  id: string;
  userId: string;
  cardNumber: string;
  cardHolderName: string;
  expiryDate: string;
  balance: number;
  cardType: "visa" | "mastercard" | "amex";
  isActive: boolean;
  cardColor: string;
}
```

### Transaction

```typescript
export interface Transaction {
  id: string;
  userId: string;
  cardId: string;
  type: "deposit" | "transfer" | "withdraw" | "payment";
  amount: number;
  description: string;
  recipient?: string;
  category: string;
  date: string;
  status: "completed" | "pending" | "failed";
}
```

### Recipient

```typescript
export interface Recipient {
  id: string;
  name: string;
  avatar: string;
  accountNumber: string;
}
```

## API Endpoints

### Database Operations

The application uses Appwrite's database service for CRUD operations on collections. Here are the planned endpoints:

#### Users Collection

- **Create User**: Creates a new user document in the users collection
- **Get User**: Retrieves a user document by ID
- **Update User**: Updates a user document
- **Delete User**: Deletes a user document

#### Cards Collection

- **Create Card**: Creates a new card document in the cards collection
- **Get Cards**: Retrieves all cards for a user
- **Get Card**: Retrieves a card document by ID
- **Update Card**: Updates a card document
- **Delete Card**: Deletes a card document

#### Transactions Collection

- **Create Transaction**: Creates a new transaction document in the transactions collection
- **Get Transactions**: Retrieves all transactions for a user or card
- **Get Transaction**: Retrieves a transaction document by ID
- **Update Transaction**: Updates a transaction document
- **Delete Transaction**: Deletes a transaction document

#### Recipients Collection

- **Create Recipient**: Creates a new recipient document in the recipients collection
- **Get Recipients**: Retrieves all recipients for a user
- **Get Recipient**: Retrieves a recipient document by ID
- **Update Recipient**: Updates a recipient document
- **Delete Recipient**: Deletes a recipient document


## Error Handling

The application handles errors by catching exceptions and either displaying error messages to the user or logging them to the console. Error handling is implemented in each API function:

```typescript
try {
  // API operation
} catch (error) {
  // Handle error
  console.error("Error message:", error);
  throw error; // or return false/null
}
```

## Configuration

### Environment Variables

The application requires the following environment variables to be set in a `.env` file:

```
EXPO_PUBLIC_APPWRITE_ENDPOINT=your_appwrite_endpoint
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id
AWS_ENDPOINT_URL_S3=https://your-app.fly.dev
```

### Appwrite Setup

1. Create an Appwrite project
2. Create a database with the following collections:
   - users
   - cards
   - transactions
   - recipients
3. Set up the appropriate attributes and indexes for each collection
4. Configure authentication methods (email/password)
5. Set up API keys and permissions

### Integration

To integrate with the Appwrite API:

1. Install the Appwrite SDK:
   ```bash
   npm install react-native-appwrite
   # or
   yarn add react-native-appwrite
   ```

2. Configure the client:
   ```typescript
   import { Client } from 'react-native-appwrite';

   const client = new Client();
   client
     .setEndpoint('https://your-appwrite-endpoint.com/v1')
     .setProject('your-project-id')
     .setPlatform('your-platform-id');
   ```

3. Use the Appwrite services:
   ```typescript
   import { Account, Databases } from 'react-native-appwrite';

   const account = new Account(client);
   const databases = new Databases(client);
   ```