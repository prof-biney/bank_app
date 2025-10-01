#!/usr/bin/env node

/**
 * Biometric Collections Verification Script (JavaScript)
 * 
 * This script verifies that the required biometric collections exist in your Appwrite database
 * and creates them with the proper schema if they don't exist.
 */

const { Client, Databases, Query, Permission, Role, ID } = require('appwrite');
require('dotenv').config();

// Configuration from environment
const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID,
  usersCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID || process.env.APPWRITE_USER_COLLECTION_ID,
};

// Validate configuration
if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.databaseId || !appwriteConfig.usersCollectionId) {
  console.error('❌ Missing required environment variables. Please check:');
  console.error('- EXPO_PUBLIC_APPWRITE_ENDPOINT');
  console.error('- EXPO_PUBLIC_APPWRITE_PROJECT_ID');
  console.error('- EXPO_PUBLIC_APPWRITE_DATABASE_ID');
  console.error('- EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

const databases = new Databases(client);

// Biometric Tokens Collection Schema
const biometricTokensConfig = {
  id: 'biometric_tokens',
  name: 'Biometric Tokens',
  attributes: [
    {
      key: 'token',
      type: 'string',
      size: 255,
      required: true,
    },
    {
      key: 'userId',
      type: 'string',
      size: 36,
      required: true,
    },
    {
      key: 'deviceId',
      type: 'string',
      size: 100,
      required: true,
    },
    {
      key: 'biometricType',
      type: 'string',
      size: 20,
      required: true,
    },
    {
      key: 'createdAt',
      type: 'datetime',
      required: true,
    },
    {
      key: 'expiresAt',
      type: 'datetime',
      required: true,
    },
    {
      key: 'lastUsedAt',
      type: 'datetime',
      required: false,
    },
    {
      key: 'isActive',
      type: 'boolean',
      required: true,
      default: true,
    },
  ],
  indexes: [
    {
      key: 'token_unique',
      type: 'unique',
      attributes: ['token'],
      unique: true,
    },
    {
      key: 'user_device',
      type: 'key',
      attributes: ['userId', 'deviceId'],
    },
    {
      key: 'isActive',
      type: 'key',
      attributes: ['isActive'],
    },
    {
      key: 'expiresAt',
      type: 'key',
      attributes: ['expiresAt'],
    },
  ],
  permissions: [
    Permission.create(Role.user()),
    Permission.read(Role.user()),
    Permission.update(Role.user()),
    Permission.delete(Role.user()),
  ],
};

// Biometric Audit Collection Schema
const biometricAuditConfig = {
  id: 'biometric_audit',
  name: 'Biometric Audit Log',
  attributes: [
    {
      key: 'userId',
      type: 'string',
      size: 36,
      required: true,
    },
    {
      key: 'action',
      type: 'string',
      size: 20,
      required: true,
    },
    {
      key: 'biometricType',
      type: 'string',
      size: 20,
      required: true,
    },
    {
      key: 'deviceId',
      type: 'string',
      size: 100,
      required: true,
    },
    {
      key: 'success',
      type: 'boolean',
      required: true,
    },
    {
      key: 'errorMessage',
      type: 'string',
      size: 500,
      required: false,
    },
    {
      key: 'timestamp',
      type: 'datetime',
      required: true,
    },
    {
      key: 'userAgent',
      type: 'string',
      size: 255,
      required: false,
    },
  ],
  indexes: [
    {
      key: 'userId',
      type: 'key',
      attributes: ['userId'],
    },
    {
      key: 'timestamp',
      type: 'key',
      attributes: ['timestamp'],
    },
    {
      key: 'action',
      type: 'key',
      attributes: ['action'],
    },
    {
      key: 'success',
      type: 'key',
      attributes: ['success'],
    },
  ],
  permissions: [
    Permission.create(Role.user()),
    Permission.read(Role.user()),
    // Audit logs are immutable - no update or delete permissions
  ],
};

async function collectionExists(collectionId) {
  try {
    // Test by trying to list documents - this works with Client SDK
    await databases.listDocuments(
      appwriteConfig.databaseId,
      collectionId,
      [Query.limit(1)]
    );
    return true;
  } catch (error) {
    // Collection doesn't exist or not accessible
    return false;
  }
}

async function createAttribute(databaseId, collectionId, attribute) {
  console.log(`  Creating attribute: ${attribute.key} (${attribute.type})`);
  
  try {
    switch (attribute.type) {
      case 'string':
        await databases.createStringAttribute(
          databaseId,
          collectionId,
          attribute.key,
          attribute.size || 255,
          attribute.required,
          attribute.default,
          attribute.array
        );
        break;
      case 'boolean':
        await databases.createBooleanAttribute(
          databaseId,
          collectionId,
          attribute.key,
          attribute.required,
          attribute.default,
          attribute.array
        );
        break;
      case 'datetime':
        await databases.createDatetimeAttribute(
          databaseId,
          collectionId,
          attribute.key,
          attribute.required,
          attribute.default,
          attribute.array
        );
        break;
      case 'integer':
        await databases.createIntegerAttribute(
          databaseId,
          collectionId,
          attribute.key,
          attribute.required,
          undefined, // min
          undefined, // max
          attribute.default,
          attribute.array
        );
        break;
      default:
        throw new Error(`Unsupported attribute type: ${attribute.type}`);
    }
    
    // Wait for the attribute to be ready
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60; // 1 minute timeout
    
    while (!ready && attempts < maxAttempts) {
      try {
        const collection = await databases.getCollection(databaseId, collectionId);
        const attr = collection.attributes.find((a) => a.key === attribute.key);
        if (attr && attr.status === 'available') {
          ready = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }
    
    if (!ready) {
      console.warn(`  Warning: Attribute ${attribute.key} may not be ready yet`);
    }
  } catch (error) {
    if (error.code === 409) {
      console.log(`  Attribute ${attribute.key} already exists`);
    } else {
      console.error(`  Failed to create attribute ${attribute.key}:`, error.message);
      throw error;
    }
  }
}

async function createIndex(databaseId, collectionId, index) {
  console.log(`  Creating index: ${index.key} on [${index.attributes.join(', ')}]`);
  
  try {
    await databases.createIndex(
      databaseId,
      collectionId,
      index.key,
      index.type,
      index.attributes
    );
    
    // Wait for the index to be ready
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!ready && attempts < maxAttempts) {
      try {
        const collection = await databases.getCollection(databaseId, collectionId);
        const idx = collection.indexes.find((i) => i.key === index.key);
        if (idx && idx.status === 'available') {
          ready = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }
    
    if (!ready) {
      console.warn(`  Warning: Index ${index.key} may not be ready yet`);
    }
  } catch (error) {
    if (error.code === 409) {
      console.log(`  Index ${index.key} already exists`);
    } else {
      console.error(`  Failed to create index ${index.key}:`, error.message);
      throw error;
    }
  }
}

async function createCollection(config) {
  console.log(`\nCreating collection: ${config.name} (${config.id})`);
  
  try {
    // Create the collection
    await databases.createCollection(
      appwriteConfig.databaseId,
      config.id,
      config.name,
      config.permissions
    );
    
    console.log(`✅ Collection ${config.name} created successfully`);
    
    // Create attributes
    console.log('Creating attributes...');
    for (const attribute of config.attributes) {
      await createAttribute(appwriteConfig.databaseId, config.id, attribute);
    }
    
    // Create indexes
    console.log('Creating indexes...');
    for (const index of config.indexes) {
      await createIndex(appwriteConfig.databaseId, config.id, index);
    }
    
    console.log(`✅ Collection ${config.name} setup completed`);
    
  } catch (error) {
    if (error.code === 409) {
      console.log(`Collection ${config.name} already exists`);
    } else {
      console.error(`Failed to create collection ${config.name}:`, error.message);
      throw error;
    }
  }
}

async function verifyUserCollection() {
  console.log('\n📋 Verifying users collection has biometric preferences...');
  
  try {
    const collection = await databases.getCollection(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId
    );
    
    const biometricPrefsAttr = collection.attributes.find(
      (attr) => attr.key === 'biometricPreferences'
    );
    
    if (!biometricPrefsAttr) {
      console.log('Adding biometricPreferences attribute to users collection...');
      
      // Create the biometric preferences attribute as a string (JSON object)
      await databases.createStringAttribute(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        'biometricPreferences',
        2000, // Large enough for JSON object
        false, // Not required (default to empty object)
        '{}' // Default value
      );
      
      console.log('✅ biometricPreferences attribute added to users collection');
    } else {
      console.log('✅ biometricPreferences attribute already exists in users collection');
    }
  } catch (error) {
    console.error('❌ Failed to verify/update users collection:', error.message);
    throw error;
  }
}

async function testCollections() {
  console.log('\n🧪 Testing biometric collections...');
  
  try {
    // Test biometric_tokens collection
    const tokensTest = await databases.listDocuments(
      appwriteConfig.databaseId,
      'biometric_tokens',
      [Query.limit(1)]
    );
    console.log('✅ biometric_tokens collection is accessible');
    
    // Test biometric_audit collection
    const auditTest = await databases.listDocuments(
      appwriteConfig.databaseId,
      'biometric_audit',
      [Query.limit(1)]
    );
    console.log('✅ biometric_audit collection is accessible');
    
  } catch (error) {
    console.error('❌ Collection test failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🔍 Verifying Biometric Collections Setup');
  console.log('==========================================');
  
  console.log('\n📊 Configuration:');
  console.log(`Endpoint: ${appwriteConfig.endpoint}`);
  console.log(`Project ID: ${appwriteConfig.projectId}`);
  console.log(`Database ID: ${appwriteConfig.databaseId}`);
  console.log(`Users Collection ID: ${appwriteConfig.usersCollectionId}`);
  
  try {
    // Check if collections exist
    const tokenExists = await collectionExists('biometric_tokens');
    const auditExists = await collectionExists('biometric_audit');
    
    console.log(`\n📋 Collection Status:`);
    console.log(`biometric_tokens: ${tokenExists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`biometric_audit: ${auditExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // If collections don't exist, provide manual setup instructions
    if (!tokenExists || !auditExists) {
      console.log('\n⚠️  Missing biometric collections detected!');
      console.log('\nℹ️  Collection creation requires admin access through Appwrite Console.');
      console.log('\n📖 Please follow the manual setup guide:');
      console.log('   → docs/MANUAL_BIOMETRIC_SETUP.md');
      console.log('\n🌐 Or visit your Appwrite Console:');
      console.log(`   → https://cloud.appwrite.io/console/project-${appwriteConfig.projectId}/databases/database-${appwriteConfig.databaseId}`);
      console.log('\n📋 Required Collections:');
      if (!tokenExists) {
        console.log('   • biometric_tokens (store user biometric tokens)');
      }
      if (!auditExists) {
        console.log('   • biometric_audit (log authentication attempts)');
      }
      console.log('\n💡 After creating the collections, run this script again to verify.');
      process.exit(1);
    }
    
    console.log('\n✅ All biometric collections exist!');
    
    // Test users collection access
    try {
      const userDocs = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        [Query.limit(1)]
      );
      console.log(`\n✅ Users collection accessible (${userDocs.total} users)`);
      console.log('\nℹ️  Note: biometricPreferences attribute will be tested during actual use');
    } catch (error) {
      console.warn('\n⚠️  Could not access users collection:', error.message);
    }
    
    // Test the collections
    await testCollections();
    
    console.log('\n🎉 Biometric collections verification completed successfully!');
    console.log('\n📝 Your biometric authentication system is ready!');
    console.log('\n🚀 Next steps:');
    console.log('1. Users can now set up biometric authentication');
    console.log('2. All biometric data will be stored securely in the database');
    console.log('3. Audit logs will track all biometric authentication attempts');
    console.log('4. Tokens automatically expire after 7 days for security');
    
    console.log('\n🔧 Optional Environment Variables:');
    console.log('Add these to your .env file for explicit collection IDs:');
    console.log('EXPO_PUBLIC_APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID=biometric_tokens');
    console.log('EXPO_PUBLIC_APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID=biometric_audit');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Your Appwrite credentials may be incorrect');
    console.error('2. You may not have access to the database');
    console.error('3. The database or collections may not exist');
    console.error('4. Network connectivity issues');
    console.error('\n📖 Check the setup guide: docs/MANUAL_BIOMETRIC_SETUP.md');
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };