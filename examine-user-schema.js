#!/usr/bin/env node

import { Client, Databases } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  userCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
};

console.log('🔍 Examining User Collection Schema');
console.log('====================================');

async function examineUserSchema() {
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const databases = new Databases(serverClient);
  
  try {
    console.log('\n1️⃣  Fetching existing user documents...');
    
    const userDocs = await databases.listDocuments(
      config.databaseId,
      config.userCollectionId
    );
    
    console.log(`Found ${userDocs.total} user documents`);
    
    if (userDocs.documents.length > 0) {
      console.log('\n📋 Sample user document structure:');
      const sampleUser = userDocs.documents[0];
      
      console.log('Fields in existing user document:');
      Object.keys(sampleUser).forEach((key, index) => {
        const value = sampleUser[key];
        const type = typeof value;
        console.log(`   ${index + 1}. ${key}: ${type} = ${JSON.stringify(value)}`);
      });
      
      console.log('\n🎯 Required fields to include in new user creation:');
      const requiredFields = Object.keys(sampleUser).filter(key => 
        !key.startsWith('$') && sampleUser[key] !== null && sampleUser[key] !== undefined
      );
      
      requiredFields.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field}`);
      });
      
    } else {
      console.log('❌ No user documents found to examine schema');
    }
    
  } catch (error) {
    console.error('❌ Failed to examine user schema:', error.message);
  }
}

async function getCollectionInfo() {
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const databases = new Databases(serverClient);
  
  try {
    console.log('\n2️⃣  Fetching collection metadata...');
    
    const collection = await databases.getCollection(
      config.databaseId,
      config.userCollectionId
    );
    
    console.log(`Collection name: ${collection.name}`);
    console.log(`Total documents: ${collection.documentsCount}`);
    console.log(`Created: ${collection.$createdAt}`);
    
    if (collection.attributes) {
      console.log('\n📝 Collection attributes:');
      collection.attributes.forEach((attr, index) => {
        console.log(`   ${index + 1}. ${attr.key}: ${attr.type} (required: ${attr.required})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to get collection info:', error.message);
  }
}

async function main() {
  await examineUserSchema();
  await getCollectionInfo();
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Use the field list above to create a proper user document');
  console.log('   2. Ensure all required fields are included');
  console.log('   3. Match the exact data types and structure');
}

main().catch(console.error);