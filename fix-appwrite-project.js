#!/usr/bin/env node

/**
 * Comprehensive Appwrite Project Fix Script
 * This script will attempt to diagnose and fix the system-wide role assignment issue
 */

import { Client, Account, Users, Databases, Teams } from 'node-appwrite';
import 'dotenv/config';

const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.EXPO_PUBLIC_APPWRITE_API_KEY,
};

console.log('🔧 Appwrite Project Fix Script');
console.log('===============================');
console.log(`Project: ${config.projectId}`);
console.log(`Endpoint: ${config.endpoint}`);

async function diagnoseWithServerKey() {
  console.log('\n1️⃣  Diagnosing with Server API Key...');
  
  if (!config.apiKey) {
    console.log('❌ No API key available for server-side diagnosis');
    return false;
  }
  
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const users = new Users(serverClient);
  
  try {
    // List users to understand the current state
    console.log('   Fetching user list...');
    const userList = await users.list();
    
    console.log(`✅ Found ${userList.total} users in the project`);
    
    // Check specific problematic user
    const problematicUser = userList.users.find(u => u.email === 'jdoe@gmail.com');
    if (problematicUser) {
      console.log(`\n   📋 User Details for jdoe@gmail.com:`);
      console.log(`   User ID: ${problematicUser.$id}`);
      console.log(`   Status: ${problematicUser.status ? 'Active' : 'Inactive'}`);
      console.log(`   Email Verified: ${problematicUser.emailVerification}`);
      console.log(`   Phone Verified: ${problematicUser.phoneVerification}`);
      console.log(`   Labels: ${problematicUser.labels?.join(', ') || 'None'}`);
      
      // Check if user has any teams/roles
      try {
        const teams = new Teams(serverClient);
        const userTeams = await teams.list();
        console.log(`   Teams Available: ${userTeams.total}`);
        
        // List team memberships for problematic user
        for (const team of userTeams.teams) {
          try {
            const memberships = await teams.listMemberships(team.$id);
            const userMembership = memberships.memberships.find(m => m.userId === problematicUser.$id);
            if (userMembership) {
              console.log(`   Team Membership: ${team.name} (${userMembership.roles.join(', ')})`);
            }
          } catch (e) {
            // Skip if can't access team memberships
          }
        }
        
      } catch (teamError) {
        console.log('   Teams: Unable to check (may not have permissions)');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Server-side diagnosis failed:', error.message);
    return false;
  }
}

async function attemptRoleFixes() {
  console.log('\n2️⃣  Attempting Role Assignment Fixes...');
  
  const serverClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  
  const users = new Users(serverClient);
  
  try {
    // Find the problematic user
    const userList = await users.list();
    const problematicUser = userList.users.find(u => u.email === 'jdoe@gmail.com');
    
    if (!problematicUser) {
      console.log('❌ Could not find user jdoe@gmail.com');
      return false;
    }
    
    console.log(`   Working with user: ${problematicUser.email} (${problematicUser.$id})`);
    
    // Attempt 1: Update user labels (if labels affect roles)
    try {
      console.log('\n   Attempt 1: Updating user labels...');
      await users.updateLabels(problematicUser.$id, ['user', 'authenticated']);
      console.log('✅ User labels updated');
    } catch (labelError) {
      console.log('⚠️  Label update failed:', labelError.message);
    }
    
    // Attempt 2: Update user status
    try {
      console.log('\n   Attempt 2: Ensuring user status is active...');
      await users.updateStatus(problematicUser.$id, true);
      console.log('✅ User status confirmed active');
    } catch (statusError) {
      console.log('⚠️  Status update failed:', statusError.message);
    }
    
    // Attempt 3: Update user preferences (in case they affect roles)
    try {
      console.log('\n   Attempt 3: Updating user preferences...');
      await users.updatePrefs(problematicUser.$id, { role: 'user', authenticated: true });
      console.log('✅ User preferences updated');
    } catch (prefsError) {
      console.log('⚠️  Preferences update failed:', prefsError.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Fix attempts failed:', error.message);
    return false;
  }
}

async function testAfterFix() {
  console.log('\n3️⃣  Testing Authentication After Fixes...');
  
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);
  
  const account = new Account(client);
  
  try {
    // Test login with the problematic user
    console.log('   Testing login...');
    const session = await account.createEmailPasswordSession('jdoe@gmail.com', 'Windows8TheBest@1234!!');
    
    console.log('✅ Session created successfully');
    
    // Test account access
    console.log('   Testing account access...');
    const user = await account.get();
    
    console.log('🎉 SUCCESS! Issue has been resolved!');
    console.log(`   User: ${user.name} (${user.email})`);
    console.log(`   Status: ${user.status ? 'Active' : 'Inactive'}`);
    
    // Clean up session
    await account.deleteSession('current');
    
    return true;
    
  } catch (error) {
    console.error('❌ Issue persists after fix attempts:', error.message);
    return false;
  }
}

async function provideFinalRecommendations(fixed) {
  console.log('\n📋 Final Analysis & Recommendations');
  console.log('====================================');
  
  if (fixed) {
    console.log('\n🎉 SUCCESS: The issue has been resolved!');
    console.log('\n📝 What was fixed:');
    console.log('   - User role assignments have been corrected');
    console.log('   - Account access is now working properly');
    console.log('   - Your app should now work correctly');
    
    console.log('\n✅ Next steps:');
    console.log('   1. Test your app again');
    console.log('   2. Monitor for any recurring issues');
    console.log('   3. Consider implementing user role validation in your app');
    
  } else {
    console.log('\n❌ Issue persists - Advanced troubleshooting required');
    console.log('\n🔍 Possible causes:');
    console.log('   1. Appwrite Cloud instance configuration bug');
    console.log('   2. Project-level permission settings issue');
    console.log('   3. SDK version compatibility problem');
    console.log('   4. Custom authentication middleware interference');
    
    console.log('\n🛠️  Advanced solutions to try:');
    console.log('   1. Create a new Appwrite project and migrate data');
    console.log('   2. Contact Appwrite support with this diagnostic info');
    console.log('   3. Check Appwrite GitHub issues for similar problems');
    console.log('   4. Consider downgrading/upgrading Appwrite SDK version');
    
    console.log('\n📞 Support Information:');
    console.log('   - Appwrite Discord: https://discord.gg/GSeTUeA');
    console.log('   - GitHub Issues: https://github.com/appwrite/appwrite/issues');
    console.log('   - Documentation: https://appwrite.io/docs');
    
    console.log('\n📋 Diagnostic Data for Support:');
    console.log(`   - Project ID: ${config.projectId}`);
    console.log(`   - Endpoint: ${config.endpoint}`);
    console.log(`   - Error: User (role: guests) missing scopes ([\"account\"])`);
    console.log(`   - Affected: ALL authenticated users`);
    console.log(`   - SDK: node-appwrite (latest)`);
  }
}

// Main execution
async function main() {
  try {
    const serverDiagnosisWorked = await diagnoseWithServerKey();
    
    if (serverDiagnosisWorked) {
      const fixesApplied = await attemptRoleFixes();
      
      if (fixesApplied) {
        // Wait a moment for changes to propagate
        console.log('\n⏳ Waiting for changes to propagate...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const issueFixed = await testAfterFix();
        await provideFinalRecommendations(issueFixed);
      } else {
        await provideFinalRecommendations(false);
      }
    } else {
      console.log('\n⚠️  Cannot perform server-side fixes without proper API key access');
      await provideFinalRecommendations(false);
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error during fix attempt:', error);
    await provideFinalRecommendations(false);
  }
}

main().catch(console.error);
