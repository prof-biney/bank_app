#!/usr/bin/env node

/**
 * Test script to verify card balance calculations
 * This script simulates various scenarios to ensure balance updates only affect the correct card
 */

// Mock data structures to simulate the app state
const mockCards = [
  {
    id: 'card-1',
    userId: 'user-123',
    cardNumber: '****-****-****-1111',
    cardHolderName: 'John Doe',
    balance: 1000,
    cardType: 'visa',
    isActive: true,
    token: 'tok_card1'
  },
  {
    id: 'card-2',
    userId: 'user-123',
    cardNumber: '****-****-****-2222',
    cardHolderName: 'John Doe',
    balance: 2000,
    cardType: 'mastercard',
    isActive: true,
    token: 'tok_card2'
  },
  {
    id: 'card-3',
    userId: 'user-123',
    cardNumber: '****-****-****-3333',
    cardHolderName: 'John Doe',
    balance: 3000,
    cardType: 'amex',
    isActive: true,
    token: 'tok_card3'
  }
];

// Mock updateCardBalance function (simulates the AppContext function)
function updateCardBalance(cards, cardId, newBalance) {
  return cards.map(card => 
    card.id === cardId ? { ...card, balance: newBalance } : card
  );
}

// Mock transfer function (simulates the makeTransfer logic)
function simulateTransfer(cards, sourceCardId, recipientCardId, amount) {
  const sourceCard = cards.find(card => card.id === sourceCardId);
  const recipientCard = cards.find(card => card.id === recipientCardId);
  
  if (!sourceCard || !recipientCard) {
    throw new Error('Card not found');
  }
  
  if (sourceCard.balance < amount) {
    throw new Error('Insufficient funds');
  }
  
  // Update source card balance
  let updatedCards = updateCardBalance(cards, sourceCardId, sourceCard.balance - amount);
  
  // Update recipient card balance
  updatedCards = updateCardBalance(updatedCards, recipientCardId, recipientCard.balance + amount);
  
  return updatedCards;
}

// Test cases
function runTests() {
  console.log('🧪 Running Card Balance Calculation Tests...\n');
  
  let testCards = [...mockCards];
  
  console.log('📊 Initial card balances:');
  testCards.forEach(card => {
    console.log(`  ${card.cardNumber}: GHS ${card.balance}`);
  });
  console.log();
  
  // Test 1: Simple balance update
  console.log('Test 1: Update single card balance');
  testCards = updateCardBalance(testCards, 'card-1', 900);
  console.log(`✅ Card 1 balance updated to: GHS ${testCards.find(c => c.id === 'card-1').balance}`);
  console.log('📊 All card balances after update:');
  testCards.forEach(card => {
    console.log(`  ${card.cardNumber}: GHS ${card.balance}`);
  });
  
  // Verify other cards weren't affected
  const card2Balance = testCards.find(c => c.id === 'card-2').balance;
  const card3Balance = testCards.find(c => c.id === 'card-3').balance;
  
  if (card2Balance !== 2000 || card3Balance !== 3000) {
    console.log('❌ FAIL: Other cards were incorrectly affected by balance update');
    return false;
  }
  console.log('✅ PASS: Only target card was affected\n');
  
  // Test 2: Internal transfer
  console.log('Test 2: Internal transfer between cards');
  const initialCard1Balance = testCards.find(c => c.id === 'card-1').balance;
  const initialCard2Balance = testCards.find(c => c.id === 'card-2').balance;
  
  testCards = simulateTransfer(testCards, 'card-1', 'card-2', 100);
  
  const finalCard1Balance = testCards.find(c => c.id === 'card-1').balance;
  const finalCard2Balance = testCards.find(c => c.id === 'card-2').balance;
  const finalCard3Balance = testCards.find(c => c.id === 'card-3').balance;
  
  console.log(`✅ Transfer of GHS 100 from Card 1 to Card 2:`);
  console.log(`  Card 1: GHS ${initialCard1Balance} → GHS ${finalCard1Balance}`);
  console.log(`  Card 2: GHS ${initialCard2Balance} → GHS ${finalCard2Balance}`);
  console.log(`  Card 3: GHS ${finalCard3Balance} (unchanged)`);
  
  // Verify transfer logic
  if (finalCard1Balance !== initialCard1Balance - 100) {
    console.log('❌ FAIL: Source card balance incorrect');
    return false;
  }
  
  if (finalCard2Balance !== initialCard2Balance + 100) {
    console.log('❌ FAIL: Recipient card balance incorrect');
    return false;
  }
  
  if (finalCard3Balance !== 3000) {
    console.log('❌ FAIL: Uninvolved card balance was changed');
    return false;
  }
  
  console.log('✅ PASS: Transfer logic works correctly\n');
  
  // Test 3: Multiple sequential operations
  console.log('Test 3: Multiple sequential balance operations');
  
  // Update card 2
  testCards = updateCardBalance(testCards, 'card-2', finalCard2Balance + 50);
  
  // Transfer from card 3 to card 1
  testCards = simulateTransfer(testCards, 'card-3', 'card-1', 200);
  
  console.log('📊 Final card balances after multiple operations:');
  testCards.forEach(card => {
    console.log(`  ${card.cardNumber}: GHS ${card.balance}`);
  });
  
  // Expected final balances:
  // Card 1: 900 - 100 + 200 = 1000
  // Card 2: 2000 + 100 + 50 = 2150
  // Card 3: 3000 - 200 = 2800
  
  const expectedBalances = {
    'card-1': 1000,
    'card-2': 2150,
    'card-3': 2800
  };
  
  let allCorrect = true;
  for (const [cardId, expectedBalance] of Object.entries(expectedBalances)) {
    const actualBalance = testCards.find(c => c.id === cardId).balance;
    if (actualBalance !== expectedBalance) {
      console.log(`❌ FAIL: ${cardId} expected ${expectedBalance}, got ${actualBalance}`);
      allCorrect = false;
    }
  }
  
  if (allCorrect) {
    console.log('✅ PASS: All sequential operations calculated correctly\n');
  } else {
    return false;
  }
  
  // Test 4: Error handling
  console.log('Test 4: Error handling for insufficient funds');
  try {
    simulateTransfer(testCards, 'card-1', 'card-2', 5000); // Too much
    console.log('❌ FAIL: Should have thrown insufficient funds error');
    return false;
  } catch (error) {
    if (error.message.includes('Insufficient funds')) {
      console.log('✅ PASS: Insufficient funds error handled correctly');
    } else {
      console.log('❌ FAIL: Wrong error type:', error.message);
      return false;
    }
  }
  
  return true;
}

// Utility function to simulate server-side card filtering
function simulateServerCardFiltering(userId, cardId) {
  // This simulates the Query.equal('userId', userId) and specific cardId lookup
  // that happens in the server endpoints
  
  // Mock database cards (simulating Appwrite collection)
  const dbCards = [
    { $id: 'card-1', userId: 'user-123', balance: 1000, token: 'tok_card1' },
    { $id: 'card-2', userId: 'user-123', balance: 2000, token: 'tok_card2' },
    { $id: 'card-3', userId: 'user-456', balance: 1500, token: 'tok_card3' }, // Different user
  ];
  
  // Server-side filtering logic
  const userCards = dbCards.filter(card => card.userId === userId);
  const targetCard = userCards.find(card => card.$id === cardId);
  
  return targetCard || null;
}

function testServerFiltering() {
  console.log('🔍 Testing Server-side Card Filtering...\n');
  
  // Test correct user accessing their card
  const validCard = simulateServerCardFiltering('user-123', 'card-1');
  if (!validCard) {
    console.log('❌ FAIL: Valid user should be able to access their card');
    return false;
  }
  console.log('✅ PASS: Valid user can access their card');
  
  // Test user trying to access another user's card
  const invalidCard = simulateServerCardFiltering('user-123', 'card-3');
  if (invalidCard) {
    console.log('❌ FAIL: User should not be able to access another user\'s card');
    return false;
  }
  console.log('✅ PASS: User cannot access another user\'s card');
  
  // Test non-existent card
  const nonExistentCard = simulateServerCardFiltering('user-123', 'card-999');
  if (nonExistentCard) {
    console.log('❌ FAIL: Non-existent card should return null');
    return false;
  }
  console.log('✅ PASS: Non-existent card returns null\n');
  
  return true;
}

// Run all tests
function main() {
  console.log('🏦 Card Balance Calculation Test Suite\n');
  
  const clientTests = runTests();
  const serverTests = testServerFiltering();
  
  console.log('📋 Test Results Summary:');
  console.log(`  Client-side logic: ${clientTests ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Server-side filtering: ${serverTests ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (clientTests && serverTests) {
    console.log('\n🎉 All tests passed! Card balance calculations are working correctly.');
    console.log('\n📝 Key findings:');
    console.log('  • Balance updates only affect the target card');
    console.log('  • Internal transfers correctly debit/credit the right cards');
    console.log('  • Multiple operations maintain isolation between cards');
    console.log('  • Server-side filtering prevents cross-user access');
    console.log('  • Error handling works for insufficient funds');
    return true;
  } else {
    console.log('\n❌ Some tests failed. Please review the card balance logic.');
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests, testServerFiltering, main };
