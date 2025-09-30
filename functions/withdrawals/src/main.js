import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log('Withdrawal function execution started');
  
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
    
    const { 
      cardId, 
      amount, 
      currency = 'GHS', 
      withdrawalMethod = 'mobile_money', 
      description, 
      bankName,
      accountNumber,
      mobileNetwork,
      mobileNumber,
      reference 
    } = requestData;
    
    log('Processing withdrawal request:', { cardId, amount, currency, withdrawalMethod });
    
    // Validate required fields
    if (!cardId || !amount) {
      return res.json({ success: false, error: 'Card ID and amount are required' }, 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return res.json({ success: false, error: 'Amount must be a positive number' }, 400);
    }
    
    if (amount > 20000) {
      return res.json({ success: false, error: 'Maximum withdrawal amount is 20,000 GHS' }, 400);
    }

    // Validate withdrawal method specific fields
    if (withdrawalMethod === 'mobile_money' && !mobileNumber) {
      return res.json({ success: false, error: 'Mobile number is required for mobile money withdrawals' }, 400);
    }
    
    if (withdrawalMethod === 'bank_transfer' && (!bankName || !accountNumber)) {
      return res.json({ success: false, error: 'Bank name and account number are required for bank transfers' }, 400);
    }

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(APPWRITE_FUNCTION_ENDPOINT)
      .setProject(APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    try {
      // Verify the card exists and has sufficient balance
      const cardDoc = await databases.getDocument('bank_app', 'cards', cardId);
      if (!cardDoc) {
        return res.json({ success: false, error: 'Card not found' }, 404);
      }

      const currentBalance = cardDoc.balance || 0;
      
      // Calculate fees
      let fee = 0;
      if (withdrawalMethod === 'mobile_money') {
        fee = Math.max(2, amount * 0.01); // 1% fee, minimum 2 GHS
      } else if (withdrawalMethod === 'bank_transfer') {
        fee = 5; // Fixed 5 GHS fee for bank transfers
      }
      
      const totalDeduction = amount + fee;
      
      if (currentBalance < totalDeduction) {
        return res.json({ 
          success: false, 
          error: `Insufficient funds. Required: ${totalDeduction} GHS (${amount} + ${fee} fee), Available: ${currentBalance} GHS` 
        }, 400);
      }

      // Calculate new balance
      const newBalance = currentBalance - totalDeduction;

      // Update card balance
      await databases.updateDocument('bank_app', 'cards', cardId, {
        balance: newBalance
      });

      // Create withdrawal transaction
      const transactionId = ID.unique();
      const withdrawalData = {
        userId: cardDoc.userId,
        cardId: cardId,
        amount: -amount, // Negative for withdrawal
        type: 'withdrawal',
        category: 'withdrawal',
        description: description || `${withdrawalMethod.replace('_', ' ')} withdrawal`,
        status: 'completed',
        currency: currency,
        withdrawalMethod: withdrawalMethod,
        fee: fee,
        ...(bankName && { bankName }),
        ...(accountNumber && { accountNumber }),
        ...(mobileNetwork && { mobileNetwork }),
        ...(mobileNumber && { mobileNumber }),
        ...(reference && { reference })
      };

      await databases.createDocument('bank_app', 'transactions', transactionId, withdrawalData);

      // Create separate fee transaction if fee > 0
      if (fee > 0) {
        const feeTransactionId = ID.unique();
        const feeData = {
          userId: cardDoc.userId,
          cardId: cardId,
          amount: -fee,
          type: 'fee',
          category: 'fee',
          description: `Withdrawal fee for ${withdrawalMethod.replace('_', ' ')}`,
          status: 'completed',
          currency: currency,
          relatedTransactionId: transactionId
        };

        await databases.createDocument('bank_app', 'transactions', feeTransactionId, feeData);
      }

      log('Withdrawal completed successfully:', { 
        transactionId, 
        cardId, 
        amount,
        fee,
        withdrawalMethod,
        newBalance 
      });

      // Generate processing instructions
      let processingInstructions = {};
      
      if (withdrawalMethod === 'mobile_money') {
        processingInstructions = {
          method: 'mobile_money',
          instructions: [
            'Your withdrawal request has been processed',
            `Amount: ${currency} ${amount}`,
            `Fee: ${currency} ${fee}`,
            `Total deducted: ${currency} ${totalDeduction}`,
            `Funds will be sent to: ${mobileNumber}`,
            'You will receive the money within 5-10 minutes',
            'You will get an SMS confirmation when complete'
          ],
          recipientNumber: mobileNumber,
          network: mobileNetwork,
          amount: amount,
          fee: fee,
          currency: currency,
          estimatedTime: '5-10 minutes'
        };
      } else if (withdrawalMethod === 'bank_transfer') {
        processingInstructions = {
          method: 'bank_transfer',
          instructions: [
            'Your bank transfer withdrawal has been processed',
            `Amount: ${currency} ${amount}`,
            `Fee: ${currency} ${fee}`,
            `Total deducted: ${currency} ${totalDeduction}`,
            `Destination: ${bankName}`,
            `Account: ${accountNumber}`,
            'Transfer will be processed within 1-2 business days',
            'You will receive email confirmation when complete'
          ],
          bankName: bankName,
          accountNumber: accountNumber,
          amount: amount,
          fee: fee,
          currency: currency,
          estimatedTime: '1-2 business days'
        };
      }

      const responseData = {
        withdrawalId: transactionId,
        cardId: cardId,
        amount: amount,
        fee: fee,
        totalDeducted: totalDeduction,
        currency: currency,
        withdrawalMethod: withdrawalMethod,
        newBalance: newBalance,
        status: 'completed',
        processingInstructions: processingInstructions,
        message: 'Withdrawal processed successfully'
      };

      return res.json({
        success: true,
        data: responseData
      });

    } catch (dbError) {
      error('Database error:', dbError);
      return res.json({ success: false, error: 'Failed to process withdrawal' }, 500);
    }

  } catch (err) {
    error('Function error:', err);
    return res.json({ success: false, error: 'Internal server error' }, 500);
  }
};