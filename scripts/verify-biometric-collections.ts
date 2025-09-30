#!/usr/bin/env npx tsx

/**
 * Biometric Collections Verification Script
 * 
 * This script verifies that the required biometric collections exist in your Appwrite database
 * and creates them with the proper schema if they don't exist.
 */

import { Client, Databases, Query, Permission, Role } from 'appwrite';
import { appwriteConfig } from '../lib/appwrite/config';

interface CollectionAttribute {
  key: string;
  type: string;
  size?: number;
  required: boolean;
  default?: any;
  array?: boolean;
}

interface IndexConfig {
  key: string;
  type: string;
  attributes: string[];
  unique?: boolean;
}

interface CollectionConfig {
  id: string;
  name: string;
  attributes: CollectionAttribute[];
  indexes: IndexConfig[];
  permissions: string[];
}

const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

const databases = new Databases(client);

// Biometric Tokens Collection Schema
const biometricTokensConfig: CollectionConfig = {
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
const biometricAuditConfig: CollectionConfig = {
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

async function collectionExists(collectionId: string): Promise<boolean> {
  try {
    await databases.getCollection(appwriteConfig.databaseId, collectionId);
    return true;
  } catch (error) {
    return false;
  }
}

async function createAttribute(
  databaseId: string,
  collectionId: string,
  attribute: CollectionAttribute
): Promise<void> {
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
        const attr = collection.attributes.find((a: any) => a.key === attribute.key);
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
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`  Attribute ${attribute.key} already exists`);
    } else {
      console.error(`  Failed to create attribute ${attribute.key}:`, error.message);
      throw error;
    }
  }
}

async function createIndex(
  databaseId: string,
  collectionId: string,
  index: IndexConfig
): Promise<void> {
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
        const idx = collection.indexes.find((i: any) => i.key === index.key);
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
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`  Index ${index.key} already exists`);
    } else {
      console.error(`  Failed to create index ${index.key}:`, error.message);
      throw error;
    }
  }
}

async function createCollection(config: CollectionConfig): Promise<void> {
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
    
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`Collection ${config.name} already exists`);
    } else {
      console.error(`Failed to create collection ${config.name}:`, error.message);
      throw error;
    }
  }
}

async function verifyUserCollection(): Promise<void> {
  console.log('\n📋 Verifying users collection has biometric preferences...');
  
  try {
    const collection = await databases.getCollection(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId
    );
    
    const biometricPrefsAttr = collection.attributes.find(
      (attr: any) => attr.key === 'biometricPreferences'
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
  } catch (error: any) {
    console.error('❌ Failed to verify/update users collection:', error.message);
    throw error;
  }
}

async function testCollections(): Promise<void> {
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
    
  } catch (error: any) {
    console.error('❌ Collection test failed:', error.message);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('🔍 Verifying Biometric Collections Setup');
  console.log('==========================================');
  
  console.log('\n📊 Configuration:');
  console.log(`Endpoint: ${appwriteConfig.endpoint}`);
  console.log(`Project ID: ${appwriteConfig.projectId}`);
  console.log(`Database ID: ${appwriteConfig.databaseId}`);
  
  try {
    // Check if collections exist
    const tokenExists = await collectionExists('biometric_tokens');
    const auditExists = await collectionExists('biometric_audit');
    
    console.log(`\n📋 Collection Status:`);
    console.log(`biometric_tokens: ${tokenExists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`biometric_audit: ${auditExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // Create missing collections
    if (!tokenExists) {
      await createCollection(biometricTokensConfig);
    } else {
      console.log(`\n✅ biometric_tokens collection already exists`);
    }
    
    if (!auditExists) {
      await createCollection(biometricAuditConfig);
    } else {
      console.log(`\n✅ biometric_audit collection already exists`);
    }
    
    // Verify users collection has biometric preferences
    await verifyUserCollection();
    
    // Test the collections
    await testCollections();
    
    console.log('\n🎉 Biometric collections verification completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Your biometric authentication system is ready to use');
    console.log('2. Users can now set up biometric authentication');
    console.log('3. All biometric data will be stored securely in the database');
    console.log('4. Audit logs will track all biometric authentication attempts');
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. Your Appwrite credentials are correct');
    console.error('2. You have permission to create collections');
    console.error('3. Your database exists and is accessible');
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { main as verifyBiometricCollections };