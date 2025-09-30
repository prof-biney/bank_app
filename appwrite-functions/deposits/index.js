/**
 * Appwrite Cloud Function for Deposit Operations
 * Handles deposit creation, confirmation, and processing
 */

const { Client, Databases, Users, ID } = require('node-appwrite');

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

const databases = new Databases(client);
const users = new Users(client);

const DATABASE_ID = process.env.DATABASE_ID;
const CARDS_COLLECTION_ID = process.env.CARDS_COLLECTION_ID;
const TRANSACTIONS_COLLECTION_ID = process.env.TRANSACTIONS_COLLECTION_ID;
const DEPOSITS_COLLECTION_ID = process.env.DEPOSITS_COLLECTION_ID;

/**
 * Main function handler
 */
module.exports = async ({ req, res, log, error }) => {
  try {
    const { method, path } = req;
    const data = req.bodyJson || {};
    
    log(`Deposit function called: ${method} ${path}`);
    
    // Route requests
    if (method === 'POST' && path === '/deposits') {
      return await createDeposit(data, { res, log, error });
    } else if (method === 'POST' && path.startsWith('/deposits/') && path.endsWith('/confirm')) {
      const depositId = path.split('/')[2];
      return await confirmDeposit(depositId, data, { res, log, error });
    } else {
      return res.json({ error: 'Invalid endpoint' }, 404);
    }
  } catch (err) {
    error('Function error:', err);
    return res.json({ error: 'Internal server error', details: err.message }, 500);
  }
};

/**
 * Create a new deposit request
 */
async function createDeposit(data, { res, log, error }) {
  try {
    const { cardId, amount, currency = 'GHS', escrowMethod, description, mobileNetwork, mobileNumber, reference } = data;
    
    // Validate required fields
    if (!cardId || !amount || amount <= 0) {
      return res.json({ error: 'Invalid card ID or amount' }, 400);
    }
    
    if (amount > 10000) {
      return res.json({ error: 'Maximum deposit amount is GHS 10,000' }, 400);
    }
    
    // Verify card exists and get current balance
    const card = await databases.getDocument(DATABASE_ID, CARDS_COLLECTION_ID, cardId);
    if (!card) {
      return res.json({ error: 'Card not found' }, 404);
    }
    
    // Create deposit record
    const depositId = ID.unique();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    
    const deposit = await databases.createDocument(
      DATABASE_ID,
      DEPOSITS_COLLECTION_ID,
      depositId,
      {
        cardId,
        amount,
        currency,
        escrowMethod: escrowMethod || 'mobile_money',
        description: description || `${escrowMethod || 'mobile_money'} deposit`,
        mobileNetwork,
        mobileNumber,
        reference: reference || `DEP-${Date.now().toString().slice(-8)}`,
        status: 'pending',
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        userId: card.userId
      }
    );
    
    // Generate payment instructions based on method
    let instructions;
    if (escrowMethod === 'mobile_money') {
      const networkNames = {
        mtn: 'MTN Mobile Money',
        telecel: 'Telecel Cash', 
        airteltigo: 'AirtelTigo Money'
      };
      
      instructions = {
        method: 'mobile_money',
        network: networkNames[mobileNetwork] || 'Mobile Money',
        steps: [
          'Dial the mobile money code for your network',
          `Send GHS ${amount.toFixed(2)} to merchant number: 055-555-0123`,
          `Use reference: ${deposit.reference}`,
          'Complete the payment on your phone',
          'Return to the app and tap "I have paid" to confirm'
        ],
        expiresAt: deposit.expiresAt,
        reference: deposit.reference
      };
    } else {
      instructions = {
        method: escrowMethod,
        steps: [
          'Follow the payment instructions provided',
          'Complete your payment',
          'Return to confirm your deposit'
        ],
        expiresAt: deposit.expiresAt,
        reference: deposit.reference
      };
    }
    
    log(`Deposit created: ${depositId} for card: ${cardId}`);
    
    return res.json({
      id: depositId,
      amount,
      currency,
      status: 'pending',
      instructions,
      reference: deposit.reference,
      expiresAt: deposit.expiresAt
    });
    
  } catch (err) {
    error('Create deposit error:', err);
    return res.json({ error: 'Failed to create deposit', details: err.message }, 500);
  }
}

/**
 * Confirm deposit payment and update card balance
 */
async function confirmDeposit(depositId, data, { res, log, error }) {
  try {
    // Get deposit record
    const deposit = await databases.getDocument(DATABASE_ID, DEPOSITS_COLLECTION_ID, depositId);
    if (!deposit) {
      return res.json({ error: 'Deposit not found' }, 404);
    }
    
    if (deposit.status !== 'pending') {
      return res.json({ error: 'Deposit already processed' }, 400);
    }
    
    // Check if expired
    if (new Date() > new Date(deposit.expiresAt)) {
      await databases.updateDocument(DATABASE_ID, DEPOSITS_COLLECTION_ID, depositId, {
        status: 'expired'
      });
      return res.json({ error: 'Deposit request has expired' }, 400);
    }
    
    // Get current card data
    const card = await databases.getDocument(DATABASE_ID, CARDS_COLLECTION_ID, deposit.cardId);
    if (!card) {
      return res.json({ error: 'Card not found' }, 404);
    }
    
    // Calculate new balance
    const newBalance = (card.balance || 0) + deposit.amount;
    
    // Update card balance
    await databases.updateDocument(DATABASE_ID, CARDS_COLLECTION_ID, deposit.cardId, {
      balance: newBalance,
      updatedAt: new Date().toISOString()
    });
    
    // Update deposit status
    await databases.updateDocument(DATABASE_ID, DEPOSITS_COLLECTION_ID, depositId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    
    // Create transaction record
    const transactionId = ID.unique();
    await databases.createDocument(
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      transactionId,
      {
        userId: deposit.userId,
        cardId: deposit.cardId,
        amount: deposit.amount,
        type: 'deposit',
        category: 'deposit',
        description: `Deposit confirmed - ${deposit.reference}`,
        status: 'completed',
        depositId: depositId,
        createdAt: new Date().toISOString()
      }
    );
    
    log(`Deposit confirmed: ${depositId}, new balance: ${newBalance}`);
    
    return res.json({
      success: true,
      amount: deposit.amount,
      newBalance: newBalance,
      cardId: deposit.cardId,
      transactionId: transactionId,
      confirmationId: deposit.reference
    });
    
  } catch (err) {
    error('Confirm deposit error:', err);
    return res.json({ error: 'Failed to confirm deposit', details: err.message }, 500);
  }
}