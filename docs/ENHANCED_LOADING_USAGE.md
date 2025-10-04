# Enhanced Loading System Usage Guide

## Overview

The banking app now includes a comprehensive loading system that provides immediate user feedback for all operations. This system combines:

- **LoadingContext**: Global loading state with overlay
- **BiometricToastContext**: Toast notifications for success/error feedback
- **Enhanced Loading Hooks**: Pre-configured loading states for common operations

## Key Features

✅ **Immediate Feedback**: Loading states appear instantly when operations begin
✅ **Smart Messaging**: Context-aware messages based on operation type and amount
✅ **Success/Error Toast**: Automatic toast notifications with appropriate messages
✅ **Progress Tracking**: Visual progress indicators with operation queuing
✅ **Error Handling**: Comprehensive error handling with user-friendly messages

## Quick Start

### 1. Basic Usage with Enhanced Hooks

```typescript
import { useAppWithLoading } from '@/hooks/useAppOperations';

function TransferScreen() {
  const { transactions } = useAppWithLoading();
  
  const handleTransfer = async () => {
    try {
      // This shows loading instantly and toast on completion
      const result = await transactions.makeTransfer(
        'card123', 
        500, 
        '1234-5678-9012-3456',
        'Rent payment'
      );
      
      if (result.success) {
        // Success toast shown automatically
        console.log('Transfer completed!');
      }
    } catch (error) {
      // Error toast shown automatically
      console.error('Transfer failed:', error);
    }
  };
}
```

### 2. Direct Hook Usage

```typescript
import { useTransactionLoading } from '@/hooks/useEnhancedLoading';
import { useApp } from '@/context/AppContext';

function DepositScreen() {
  const { makeDeposit } = useApp();
  const { withDeposit } = useTransactionLoading();
  
  const handleDeposit = async () => {
    try {
      const result = await withDeposit(
        () => makeDeposit({ cardId: 'card123', amount: 1000 }),
        1000 // Amount for contextualized messages
      );
    } catch (error) {
      // Handle error
    }
  };
}
```

## Available Enhanced Operations

### Authentication Operations

```typescript
import { useEnhancedAuth } from '@/hooks/useAppOperations';

const { auth } = useAppWithLoading();

// Login with loading and success/error feedback
await auth.login('user@example.com', 'password');

// Register with immediate feedback
await auth.register('user@example.com', 'password', 'John Doe');

// Setup biometric authentication
await auth.setupBiometric();

// Authenticate with biometrics
await auth.authenticateWithBiometric();

// Update profile picture with progress
await auth.updateProfilePicture('file://path/to/image.jpg');
```

### Transaction Operations

```typescript
const { transactions } = useAppWithLoading();

// Transfer with amount-specific loading message
await transactions.makeTransfer(cardId, 500, recipientCard, 'Payment');

// Withdrawal with contextualized feedback
await transactions.makeWithdrawal(cardId, 200, 'mobile_money', details);

// Deposit with progress tracking
await transactions.makeDeposit({ cardId, amount: 1000, escrowMethod: 'mobile_money' });

// Delete transaction with confirmation
await transactions.deleteTransaction('txn123');

// Clear all transactions with warning
await transactions.clearAllTransactions();
```

### Card Operations

```typescript
const { cards } = useAppWithLoading();

// Add card with validation feedback
await cards.addCard({
  cardNumber: '1234-5678-9012-3456',
  cardHolderName: 'John Doe',
  expiryDate: '12/25',
  cardType: 'visa',
  cardColor: '#1e40af'
});

// Remove card with confirmation
await cards.removeCard('card123');

// Update balance with immediate feedback
await cards.updateCardBalance('card123', 2500);

// Refresh balances with progress
await cards.refreshCardBalances();
```

### Data Management Operations

```typescript
const { data } = useAppWithLoading();

// Clear activity with confirmation
await data.clearAllActivity();

// Delete specific activity
await data.deleteActivity('activity123');

// Clear notifications with feedback
await data.clearAllNotifications();

// Mark all notifications as read
await data.markAllNotificationsRead();
```

## Loading States and Messages

### Contextual Loading Messages

The system automatically generates contextual messages based on:

- **Operation type**: "Processing your transfer...", "Adding your card..."
- **Amount**: "Processing deposit of GHS 500.00...", "Transferring GHS 1,000.00..."
- **Context**: "Setting up biometric authentication...", "Uploading profile picture..."

### Toast Notifications

Success and error toasts are shown automatically with appropriate messages:

- ✅ **Success**: "Transfer completed successfully!", "Card added successfully!"
- ❌ **Error**: "Transfer failed. Please try again.", "Failed to add card. Please try again."

## Advanced Usage

### Custom Loading Operations

```typescript
import { useEnhancedLoading } from '@/hooks/useEnhancedLoading';

function CustomOperation() {
  const { withLoading } = useEnhancedLoading();
  
  const performCustomOperation = async () => {
    return withLoading(
      async () => {
        // Your custom operation here
        await someAsyncOperation();
      },
      'custom', // Operation type
      {
        showToast: true,
        customLoadingMessage: 'Processing your request...',
        successMessage: 'Operation completed successfully!',
        errorMessage: 'Operation failed. Please try again.',
      }
    );
  };
}
```

### Direct Loading Context Usage

```typescript
import { useLoading } from '@/context/LoadingContext';
import { useBiometricToast } from '@/context/BiometricToastContext';

function DirectUsageExample() {
  const loading = useLoading();
  const toast = useBiometricToast();
  
  const handleOperation = async () => {
    const operationId = loading.startLoading('custom', 'Processing...');
    
    try {
      await performOperation();
      toast.showSuccess('Success', 'Operation completed!');
    } catch (error) {
      toast.showError('Error', 'Operation failed!');
    } finally {
      loading.stopLoading(operationId);
    }
  };
}
```

## Loading Operation Types

The system supports these predefined operation types with optimized messages:

- `deposit` - "Processing deposit..."
- `transfer` - "Processing transfer..."  
- `add_card` - "Adding card..."
- `delete_card` - "Removing card..."
- `update_balance` - "Updating balance..."
- `sync_data` - "Syncing data..."
- `login` - "Signing in..."
- `register` - "Creating account..."
- `custom` - "Processing..." (customizable)

## Integration with Existing Components

### Replace Direct Context Usage

**Before:**
```typescript
import { useApp } from '@/context/AppContext';

const { makeTransfer } = useApp();
await makeTransfer(cardId, amount, recipient);
```

**After:**
```typescript
import { useAppWithLoading } from '@/hooks/useAppOperations';

const { transactions } = useAppWithLoading();
await transactions.makeTransfer(cardId, amount, recipient);
```

### Biometric Operations

**Before:**
```typescript
import useAuthStore from '@/store/auth.store';

const { setupBiometric } = useAuthStore();
await setupBiometric();
```

**After:**
```typescript
import { useEnhancedAuth } from '@/hooks/useAppOperations';

const { setupBiometric } = useEnhancedAuth();
await setupBiometric(); // Now shows "Setting up biometric authentication..."
```

## Best Practices

1. **Use Enhanced Hooks**: Always prefer the enhanced versions for user-facing operations
2. **Contextual Messages**: Let the system generate contextual messages based on operation type and amount
3. **Error Handling**: Always wrap operations in try-catch blocks
4. **User Experience**: Don't show loading for instant operations like logout
5. **Feedback**: Use the automatic toast system for consistent user feedback

## Provider Setup

Ensure your app is wrapped with the necessary providers:

```typescript
import { LoadingProvider } from '@/context/LoadingContext';
import { BiometricToastProvider } from '@/context/BiometricToastContext';

function App() {
  return (
    <BiometricToastProvider>
      <LoadingProvider>
        <AppProvider>
          {/* Your app components */}
        </AppProvider>
      </LoadingProvider>
    </BiometricToastProvider>
  );
}
```

## Troubleshooting

### Loading Not Showing
- Verify `LoadingProvider` is properly set up
- Check that the operation is wrapped with a loading hook
- Ensure operation is actually async

### Toasts Not Appearing
- Verify `BiometricToastProvider` is properly set up
- Check that `showToast: true` is set in options
- Ensure success/error messages are provided

### Incorrect Messages
- Check operation type matches expected type
- Verify amount parameter is provided for transaction operations
- Use `customLoadingMessage` for specific requirements

With this enhanced loading system, every user action in the banking app now provides immediate, contextual feedback, creating a much more responsive and professional user experience.