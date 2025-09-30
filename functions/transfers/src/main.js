import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log('Transfer function execution started');
  
  try {
    const { APPWRITE_FUNCTION_ENDPOINT, APPWRITE_FUNCTION_PROJECT_ID, APPWRITE_FUNCTION_API_KEY } = req.variables;
    
    if (!APPWRITE_FUNCTION_ENDPOINT || !APPWRITE_FUNCTION_PROJECT_ID || !APPWRITE_FUNCTION_API_KEY) {
      error('Missing required environment variables');
      return res.json({ success: false, error: 'Server configuration error' }, 500);
    }
    
    // Parse request body
    let requestData;
    try {
      requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.json({ success: false, error: 'Invalid JSON in request body' }, 400);
    }
    
    const { cardId, amount, currency = 'GHS', recipient, recipientName, description } = requestData;
    
    log('Processing transfer request:', { cardId, amount, currency, recipient });
    
    // Validate required fields
    if (!cardId || !amount || !recipient) {
      return res.json({ success: false, error: 'Card ID, amount, and recipient are required' }, 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return res.json({ success: false, error: 'Amount must be a positive number' }, 400);
    }
    
    if (amount > 50000) {
      return res.json({ success: false, error: 'Maximum transfer amount is 50,000 GHS' }, 400);
    }

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(APPWRITE_FUNCTION_ENDPOINT)
      .setProject(APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    try {
      // Verify the source card exists and has sufficient balance
      const sourceCardDoc = await databases.getDocument('bank_app', 'cards', cardId);
      if (!sourceCardDoc) {
        return res.json({ success: false, error: 'Source card not found' }, 404);
      }

      const currentBalance = sourceCardDoc.balance || 0;
      if (currentBalance < amount) {
        return res.json({ success: false, error: 'Insufficient funds for this transfer' }, 400);
      }

      // Calculate new balance
      const newBalance = currentBalance - amount;

      // Update source card balance
      await databases.updateDocument('bank_app', 'cards', cardId, {
        balance: newBalance
      });

      // Create transfer transaction
      const transactionId = ID.unique();
      const transferData = {
        userId: sourceCardDoc.userId,
        cardId: cardId,
        amount: -amount, // Negative for outgoing transfer
        type: 'transfer',
        category: 'transfer',
        description: description || `Transfer to ${recipientName || recipient}`,
        status: 'completed',
        currency: currency,
        recipient: recipient,
        ...(recipientName && { recipientName })
      };

      await databases.createDocument('bank_app', 'transactions', transactionId, transferData);

      log('Transfer completed successfully:', { 
        transactionId, 
        cardId, 
        amount, 
        recipient,
        newBalance 
      });

      const responseData = {
        transferId: transactionId,
        cardId: cardId,
        amount: amount,
        currency: currency,
        recipient: recipient,
        newBalance: newBalance,
        status: 'completed',
        message: 'Transfer completed successfully'
      };

      return res.json({
        success: true,
        data: responseData
      });

    } catch (dbError) {
      error('Database error:', dbError);
      return res.json({ success: false, error: 'Failed to process transfer' }, 500);
    }

  } catch (err) {
    error('Function error:', err);
    return res.json({ success: false, error: 'Internal server error' }, 500);
  }
};