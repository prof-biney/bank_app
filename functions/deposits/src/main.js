import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log('Deposit function execution started');
  
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
    
    // Handle deposit confirmation
    if (requestData.action === 'confirm' && requestData.depositId) {
      log('Processing deposit confirmation:', { depositId: requestData.depositId });
      
      // Initialize Appwrite client
      const client = new Client()
        .setEndpoint(APPWRITE_FUNCTION_ENDPOINT)
        .setProject(APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(APPWRITE_FUNCTION_API_KEY);
      
      const databases = new Databases(client);
      
      try {
        // Find the deposit record
        const depositDoc = await databases.getDocument('bank_app', 'transactions', requestData.depositId);
        
        if (!depositDoc) {
          return res.json({ success: false, error: 'Deposit not found' }, 404);
        }
        
        if (depositDoc.type !== 'deposit') {
          return res.json({ success: false, error: 'Invalid deposit record' }, 400);
        }
        
        if (depositDoc.status === 'completed') {
          return res.json({ success: false, error: 'Deposit already confirmed' }, 400);
        }
        
        // Update deposit status to completed
        await databases.updateDocument('bank_app', 'transactions', requestData.depositId, {
          status: 'completed',
          confirmedAt: new Date().toISOString()
        });
        
        // Get the card and update balance
        const cardDoc = await databases.getDocument('bank_app', 'cards', depositDoc.cardId);
        const newBalance = (cardDoc.balance || 0) + depositDoc.amount;
        
        await databases.updateDocument('bank_app', 'cards', depositDoc.cardId, {
          balance: newBalance
        });
        
        log('Deposit confirmed successfully:', {
          depositId: requestData.depositId,
          cardId: depositDoc.cardId,
          amount: depositDoc.amount,
          newBalance
        });
        
        return res.json({
          success: true,
          data: {
            confirmationId: requestData.depositId,
            cardId: depositDoc.cardId,
            amount: depositDoc.amount,
            newBalance,
            status: 'completed'
          }
        });
        
      } catch (dbError) {
        error('Database error during confirmation:', dbError);
        return res.json({ success: false, error: 'Failed to confirm deposit' }, 500);
      }
    }
    
    // Handle new deposit creation
    const { cardId, amount, currency = 'GHS', escrowMethod = 'mobile_money', description, mobileNetwork, mobileNumber, reference } = requestData;
    
    log('Processing deposit request:', { cardId, amount, currency, escrowMethod });
    
    // Validate required fields
    if (!cardId || !amount) {
      return res.json({ success: false, error: 'Card ID and amount are required' }, 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return res.json({ success: false, error: 'Amount must be a positive number' }, 400);
    }
    
    if (amount > 10000) {
      return res.json({ success: false, error: 'Maximum deposit amount is 10,000 GHS' }, 400);
    }

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(APPWRITE_FUNCTION_ENDPOINT)
      .setProject(APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    try {
      // Verify the card exists
      const cardDoc = await databases.getDocument('bank_app', 'cards', cardId);
      if (!cardDoc) {
        return res.json({ success: false, error: 'Card not found' }, 404);
      }

      // Create pending deposit transaction
      const transactionId = ID.unique();
      const depositData = {
        userId: cardDoc.userId,
        cardId: cardId,
        amount: amount,
        type: 'deposit',
        category: 'deposit',
        description: description || `${escrowMethod.replace('_', ' ')} deposit`,
        status: 'pending',
        currency: currency,
        escrowMethod: escrowMethod,
        ...(mobileNetwork && { mobileNetwork }),
        ...(mobileNumber && { mobileNumber }),
        ...(reference && { reference })
      };

      await databases.createDocument('bank_app', 'transactions', transactionId, depositData);

      log('Deposit transaction created:', { transactionId, cardId, amount });

      // Generate payment instructions based on escrow method
      let paymentInstructions = {};
      
      if (escrowMethod === 'mobile_money') {
        paymentInstructions = {
          method: 'mobile_money',
          instructions: [
            'Dial *170# on your mobile phone',
            'Select "Send Money"',
            `Send GHS ${amount} to 0244123456`,
            `Reference: DEP${transactionId.slice(-8)}`,
            'Complete the transaction with your mobile money PIN',
            'You will receive a confirmation SMS'
          ],
          reference: `DEP${transactionId.slice(-8)}`,
          recipientNumber: '0244123456',
          amount: amount,
          currency: currency
        };
      } else if (escrowMethod === 'bank_transfer') {
        paymentInstructions = {
          method: 'bank_transfer',
          instructions: [
            'Transfer money to the following bank account:',
            'Bank: GTBank Ghana',
            'Account Name: BankApp Escrow',
            'Account Number: 0123456789',
            `Amount: GHS ${amount}`,
            `Reference: DEP${transactionId.slice(-8)}`,
            'Send proof of payment to support@bankapp.com'
          ],
          reference: `DEP${transactionId.slice(-8)}`,
          bankName: 'GTBank Ghana',
          accountName: 'BankApp Escrow',
          accountNumber: '0123456789',
          amount: amount,
          currency: currency
        };
      } else {
        paymentInstructions = {
          method: 'generic',
          instructions: [
            `Complete your ${escrowMethod.replace('_', ' ')} payment`,
            `Amount: ${currency} ${amount}`,
            `Reference: DEP${transactionId.slice(-8)}`
          ],
          reference: `DEP${transactionId.slice(-8)}`,
          amount: amount,
          currency: currency
        };
      }

      const responseData = {
        depositId: transactionId,
        cardId: cardId,
        amount: amount,
        currency: currency,
        status: 'pending',
        paymentInstructions: paymentInstructions,
        message: `Deposit request created successfully. Follow the payment instructions to complete your deposit.`
      };

      log('Deposit response prepared:', { depositId: transactionId, paymentMethod: escrowMethod });

      return res.json({
        success: true,
        data: responseData
      });

    } catch (dbError) {
      error('Database error:', dbError);
      return res.json({ success: false, error: 'Failed to process deposit request' }, 500);
    }

  } catch (err) {
    error('Function error:', err);
    return res.json({ success: false, error: 'Internal server error' }, 500);
  }
};