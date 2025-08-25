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

BankApp uses [Appwrite](https://appwrite.io/) as its backend service for authentication, database operations, and file storage. The application is currently in development mode and uses mock data for testing, with plans to fully integrate with Appwrite for production.

## Authentication

### Configuration

Authentication is configured in `lib/appwrite.ts`:

```typescript
export const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  platform: "com.profbiney.vault",
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseId: "688951e80021396d424f",
  userCollectionId: "688a76c0003178d28a3e",
};

export const client = new Client();

client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(appwriteConfig.platform);

export const account = new Account(client);
export const databases = new Databases(client);
```

### Authentication Methods

#### Create User

Creates a new user account and automatically signs them in.

```typescript
export const createUser = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) => {
  try {
    const newAccount = await account.create(ID.unique(), email, password, name);

    if (!newAccount) {
      throw new Error("Failed to create account");
    }
    await signIn(email, password);

    const avatarUrl = avatars.getInitialsURL(name);

    return await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      {
        accountId: newAccount.$id,
        name,
        email,
        avatar: avatarUrl,
      }
    );
  } catch (error) {
    throw error;
  }
};
```

**Parameters:**
- `name`: User's full name
- `email`: User's email address
- `password`: User's password

**Returns:**
- A document containing the user's information

**Errors:**
- Throws an error if account creation fails

#### Sign In

Creates an email/password session for authentication.

```typescript
export const signIn = async (email: string, password: string) => {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    return session;
  } catch (error) {
    throw error;
  }
};
```

**Parameters:**
- `email`: User's email address
- `password`: User's password

**Returns:**
- A session object

**Errors:**
- Throws an error if authentication fails

#### Sign Out

Deletes the current session.

```typescript
export const signOut = async () => {
  try {
    await account.deleteSession("current");
  } catch (error) {
    throw error;
  }
};
```

**Errors:**
- Throws an error if sign out fails

#### Get Current User

Retrieves the current user's information.

```typescript
export const getCurrentUser = async () => {
  try {
    // get the current account
    const currentAccount = await account.get();

    if (!currentAccount) {
      throw new Error("No user found");
    }

    // get the user from the database
    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );

    if (!currentUser) throw Error;

    // return the user
    return currentUser.documents[0];
  } catch (error) {
    throw new Error(error as string);
  }
};
```

**Returns:**
- The current user's document

**Errors:**
- Throws an error if no user is found or if retrieval fails

### Mock Authentication (Development)

For development and testing, the application uses mock authentication implemented in `context/AuthContext.tsx`:

```typescript
const signIn = async (email: string, password: string): Promise<boolean> => {
  try {
    // Mock authentication - replace with Appwrite auth
    const mockUser: User = {
      id: "1",
      email,
      name: "Andrew Biney",
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("user", JSON.stringify(mockUser));
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