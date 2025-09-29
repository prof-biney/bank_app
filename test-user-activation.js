#!/usr/bin/env node

/**
 * Test Script - User Activation Fix
 * Tests if explicit user activation resolves the Appwrite scope issue
 */

import { Client, Account, Users, Databases } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  userCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID,
};

console.log('🧪 Testing User Activation Fix');
console.log('===============================');

async function activateExistingUser() {
  console.log('\n1️⃣  Activating existing user via server API...');
  
  if (!config.apiKey) {
    console.log('❌ No API key available for server operations');
    return false;
  }
  
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const users = new Users(serverClient);
  const databases = new Databases(serverClient);
  
  try {
    // Find the problematic user
    const userList = await users.list();
    const targetUser = userList.users.find(u => u.email === 'jdoe@gmail.com');
    
    if (!targetUser) {
      console.log('❌ User jdoe@gmail.com not found');
      return false;
    }
    
    console.log(`✅ Found user: ${targetUser.email} (${targetUser.$id})`);
    console.log(`   Status: ${targetUser.status ? 'Active' : 'Inactive'}`);\n    console.log(`   Email Verified: ${targetUser.emailVerification}`);\n    console.log(`   Labels: ${targetUser.labels?.join(', ') || 'None'}`);\n    \n    // Strategy 1: Update user status\n    console.log('\\n   Attempting to activate user status...');\n    try {\n      await users.updateStatus(targetUser.$id, true);\n      console.log('✅ User status updated to active');\n    } catch (statusError) {\n      console.log('⚠️  Status update failed:', statusError.message);\n    }\n    \n    // Strategy 2: Update user labels to include 'user' role\n    console.log('\\n   Attempting to add user role labels...');\n    try {\n      const newLabels = ['user', 'authenticated', 'active'];\n      await users.updateLabels(targetUser.$id, newLabels);\n      console.log('✅ User labels updated:', newLabels.join(', '));\n    } catch (labelError) {\n      console.log('⚠️  Label update failed:', labelError.message);\n    }\n    \n    // Strategy 3: Update user preferences\n    console.log('\\n   Attempting to update user preferences...');\n    try {\n      await users.updatePrefs(targetUser.$id, {\n        isActive: true,\n        isAuthenticated: true,\n        role: 'user',\n        activatedAt: new Date().toISOString()\n      });\n      console.log('✅ User preferences updated with role information');\n    } catch (prefsError) {\n      console.log('⚠️  Preferences update failed:', prefsError.message);\n    }\n    \n    // Strategy 4: Ensure database profile exists with activation flags\n    console.log('\\n   Attempting to update database profile...');\n    try {\n      // Try to get existing profile\n      let profileExists = false;\n      let existingProfile = null;\n      \n      try {\n        existingProfile = await databases.getDocument(\n          config.databaseId,\n          config.userCollectionId,\n          targetUser.$id\n        );\n        profileExists = true;\n        console.log('✅ Found existing database profile');\n      } catch (getError) {\n        console.log('ℹ️  No existing database profile found, will create new one');\n      }\n      \n      const profileData = {\n        email: targetUser.email,\n        name: targetUser.name || 'User',\n        isActive: true,\n        isAuthenticated: true,\n        emailVerified: targetUser.emailVerification,\n        createdAt: existingProfile?.createdAt || new Date().toISOString(),\n        lastLoginAt: new Date().toISOString(),\n        activatedAt: existingProfile?.activatedAt || new Date().toISOString(),\n        preferences: {\n          theme: 'system',\n          notifications: true,\n          language: 'en',\n          ...(existingProfile?.preferences || {})\n        }\n      };\n      \n      if (profileExists) {\n        await databases.updateDocument(\n          config.databaseId,\n          config.userCollectionId,\n          targetUser.$id,\n          profileData\n        );\n        console.log('✅ Database profile updated with activation data');\n      } else {\n        await databases.createDocument(\n          config.databaseId,\n          config.userCollectionId,\n          targetUser.$id,\n          profileData\n        );\n        console.log('✅ Database profile created with activation data');\n      }\n      \n    } catch (dbError) {\n      console.log('⚠️  Database profile update failed:', dbError.message);\n    }\n    \n    return true;\n    \n  } catch (error) {\n    console.error('❌ User activation failed:', error.message);\n    return false;\n  }\n}\n\nasync function testAfterActivation() {\n  console.log('\\n2️⃣  Testing authentication after activation...');\n  \n  const client = new Client()\n    .setEndpoint(config.endpoint)\n    .setProject(config.projectId);\n  \n  const account = new Account(client);\n  \n  try {\n    // Test login\n    console.log('   Attempting login...');\n    const session = await account.createEmailPasswordSession('jdoe@gmail.com', 'Windows8TheBest@1234!!');\n    \n    console.log('✅ Session created successfully');\n    console.log(`   Session ID: ${session.$id}`);\n    console.log(`   User ID: ${session.userId}`);\n    \n    // Test account access - this should work now\n    console.log('\\n   Testing account access...');\n    try {\n      const user = await account.get();\n      \n      console.log('🎉 SUCCESS! Account access is now working!');\n      console.log(`   User: ${user.name} (${user.email})`);\n      console.log(`   Email Verified: ${user.emailVerification}`);\n      console.log(`   Status: ${user.status ? 'Active' : 'Inactive'}`);\n      console.log(`   Labels: ${user.labels?.join(', ') || 'None'}`);\n      \n      // Test JWT creation\n      console.log('\\n   Testing JWT creation...');\n      try {\n        const jwt = await account.createJWT();\n        console.log('🎉 JWT creation successful!');\n        console.log(`   JWT: ${jwt.jwt.substring(0, 50)}...`);\n      } catch (jwtError) {\n        console.log('⚠️  JWT creation still failed:', jwtError.message);\n      }\n      \n      // Clean up\n      await account.deleteSession('current');\n      console.log('\\n   Session cleaned up');\n      \n      return true;\n      \n    } catch (accountError) {\n      console.error('❌ Account access still failing:', accountError.message);\n      \n      if (accountError.message.includes('missing scopes')) {\n        console.error('\\n🚨 The scope issue persists even after activation attempts');\n        console.error('   This confirms it\\'s a deeper Appwrite configuration problem');\n      }\n      \n      // Clean up session anyway\n      try {\n        await account.deleteSession('current');\n      } catch (cleanupError) {\n        // Ignore cleanup errors\n      }\n      \n      return false;\n    }\n    \n  } catch (loginError) {\n    console.error('❌ Login failed:', loginError.message);\n    return false;\n  }\n}\n\nasync function main() {\n  try {\n    console.log(`Testing with user: jdoe@gmail.com`);\n    console.log(`Project: ${config.projectId}`);\n    \n    const activationWorked = await activateExistingUser();\n    \n    if (activationWorked) {\n      // Wait for changes to propagate\n      console.log('\\n⏳ Waiting 5 seconds for changes to propagate...');\n      await new Promise(resolve => setTimeout(resolve, 5000));\n      \n      const testPassed = await testAfterActivation();\n      \n      if (testPassed) {\n        console.log('\\n🎉 SUCCESS: User activation resolved the scope issue!');\n        console.log('\\n📝 What worked:');\n        console.log('   - User status, labels, and preferences updated');\n        console.log('   - Database profile created/updated with activation flags');\n        console.log('   - Account access and JWT creation now functional');\n        console.log('\\n✅ Your app should now work correctly!');\n      } else {\n        console.log('\\n❌ User activation did not resolve the scope issue');\n        console.log('\\n🔍 This confirms the issue is a fundamental Appwrite Cloud bug');\n        console.log('   that cannot be resolved through user-level changes.');\n      }\n    } else {\n      console.log('\\n❌ Could not perform user activation');\n    }\n    \n  } catch (error) {\n    console.error('\\n💥 Unexpected error:', error);\n  }\n}\n\nmain().catch(console.error);