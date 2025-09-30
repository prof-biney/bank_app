/**
 * Appwrite Collections Setup Script
 * 
 * This script creates the missing collections and attributes required for the transaction approval system
 * and fixes existing collection schemas.
 */

// Load environment variables
require('dotenv').config();

const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.EXPO_PUBLIC_APPWRITE_API_KEY;
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const NOTIFICATIONS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !DATABASE_ID) {
    console.error('❌ Missing required environment variables');
    console.error('Required: EXPO_PUBLIC_APPWRITE_ENDPOINT, EXPO_PUBLIC_APPWRITE_PROJECT_ID, EXPO_PUBLIC_APPWRITE_API_KEY, EXPO_PUBLIC_APPWRITE_DATABASE_ID');
    process.exit(1);
}

// Helper function to make API requests
async function appwriteRequest(method, path, data = null) {
    const url = `${APPWRITE_ENDPOINT}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
        'X-Appwrite-Key': APPWRITE_API_KEY
    };

    const options = {
        method,
        headers
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(`${result.message || 'API request failed'} (${response.status})`);
        }
        
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('Cannot connect to Appwrite server. Please check your endpoint.');
        }
        throw error;
    }
}

async function setupCollections() {
    console.log('🚀 Starting Appwrite collections setup...');
    
    try {
        // 1. Create transaction_approvals collection
        await createTransactionApprovalsCollection();
        
        // 2. Fix notifications collection schema
        await fixNotificationsCollection();
        
        // 3. Verify all collections
        await verifyCollections();
        
        console.log('✅ All collections setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

async function createTransactionApprovalsCollection() {
    console.log('📝 Creating transaction_approvals collection...');
    
    try {
        // Check if collection already exists
        try {
            await appwriteRequest('GET', `/databases/${DATABASE_ID}/collections/transaction_approvals`);
            console.log('ℹ️  transaction_approvals collection already exists, skipping creation...');
            return;
        } catch (error) {
            // Collection doesn't exist, create it
        }
        
        // Create the collection
        await appwriteRequest('POST', `/databases/${DATABASE_ID}/collections`, {
            collectionId: 'transaction_approvals',
            name: 'Transaction Approvals',
            permissions: [
                'read("any")',
                'create("any")',
                'update("any")',
                'delete("any")'
            ],
            documentSecurity: false,
            enabled: true
        });
        
        console.log('✅ transaction_approvals collection created');
        
        // Create attributes
        const attributes = [
            { key: 'transactionId', type: 'string', size: 255, required: true },
            { key: 'userId', type: 'string', size: 255, required: true },
            { key: 'approvalType', type: 'string', size: 50, required: true },
            { key: 'status', type: 'string', size: 50, required: true, default: 'pending' },
            { key: 'approvedAt', type: 'datetime', required: false },
            { key: 'approvedBy', type: 'string', size: 255, required: false },
            { key: 'rejectedAt', type: 'datetime', required: false },
            { key: 'rejectionReason', type: 'string', size: 500, required: false },
            { key: 'expiresAt', type: 'datetime', required: true },
            { key: 'createdAt', type: 'datetime', required: true },
            { key: 'metadata', type: 'string', size: 10000, required: false }
        ];
        
        for (const attr of attributes) {
            console.log(`  Adding attribute: ${attr.key}`);
            
            if (attr.type === 'string') {
                await databases.createStringAttribute(
                    databaseId,
                    'transaction_approvals',
                    attr.key,
                    attr.size,
                    attr.required,
                    attr.default
                );
            } else if (attr.type === 'datetime') {
                await databases.createDatetimeAttribute(
                    databaseId,
                    'transaction_approvals',
                    attr.key,
                    attr.required,
                    attr.default
                );
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Create indexes
        console.log('  Creating indexes...');
        await databases.createIndex(
            databaseId,
            'transaction_approvals',
            'userId_index',
            'key',
            ['userId']
        );
        
        await databases.createIndex(
            databaseId,
            'transaction_approvals',
            'status_index',
            'key',
            ['status']
        );
        
        await databases.createIndex(
            databaseId,
            'transaction_approvals',
            'transactionId_index',
            'key',
            ['transactionId']
        );
        
        console.log('✅ transaction_approvals collection setup completed');
        
    } catch (error) {
        console.error('❌ Failed to create transaction_approvals collection:', error);
        throw error;
    }
}

async function fixNotificationsCollection() {
    console.log('🔧 Fixing notifications collection schema...');
    
    try {
        const notificationCollectionId = process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID;
        
        if (!notificationCollectionId) {
            console.log('ℹ️  Notifications collection ID not configured, skipping...');
            return;
        }
        
        // Check if archived attribute exists
        try {
            const collection = await databases.getCollection(databaseId, notificationCollectionId);
            const hasArchivedAttr = collection.attributes.some(attr => attr.key === 'archived');
            
            if (hasArchivedAttr) {
                console.log('ℹ️  archived attribute already exists in notifications collection');
                return;
            }
        } catch (error) {
            console.log('ℹ️  Notifications collection not found, skipping schema fix...');
            return;
        }
        
        // Add archived attribute
        console.log('  Adding archived attribute to notifications collection...');
        await databases.createBooleanAttribute(
            databaseId,
            notificationCollectionId,
            'archived',
            false, // required
            false  // default value
        );
        
        console.log('✅ notifications collection schema fixed');
        
    } catch (error) {
        console.error('❌ Failed to fix notifications collection:', error);
        // Don't throw error as this is not critical for approval system
        console.log('⚠️  Continuing without notification schema fix...');
    }
}

async function verifyCollections() {
    console.log('🔍 Verifying collections...');
    
    const collections = [
        'transaction_approvals',
        process.env.EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID,
        process.env.EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID,
        process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID
    ].filter(Boolean);
    
    for (const collectionId of collections) {
        try {
            const collection = await databases.getCollection(databaseId, collectionId);
            console.log(`✅ ${collection.name} (${collectionId}) - ${collection.attributes.length} attributes`);
        } catch (error) {
            console.log(`❌ ${collectionId} - Not found or inaccessible`);
        }
    }
}

// Run the setup
if (require.main === module) {
    setupCollections();
}

module.exports = { setupCollections };