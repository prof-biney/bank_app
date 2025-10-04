import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import ApprovalBadge from '../ApprovalBadge';
import TransactionApproval from '../TransactionApproval';

/**
 * Example component demonstrating how to integrate the transaction approval system
 * This shows how to:
 * 1. Display pending approvals badge in the header
 * 2. Handle transaction operations that might require approval
 * 3. Show approval modal when needed
 * 4. Handle approval completion callbacks
 */
const ApprovalSystemExample: React.FC = () => {
  const {
    makeDeposit,
    makeTransaction,
    makeTransfer,
    pendingApprovalsCount,
    handleApprovalStatusChange,
    refreshPendingApprovals,
    activeCard,
  } = useApp();

  const [showApprovals, setShowApprovals] = useState(false);
  const [loading, setLoading] = useState(false);

  // Example deposit with approval requirement
  const handleLargeDeposit = async () => {
    if (!activeCard) {
      Alert.alert('Error', 'No active card selected');
      return;
    }

    setLoading(true);
    try {
      const result = await makeDeposit({
        cardId: activeCard.id,
        amount: 1500, // Amount over 1000 GHS will require approval
        currency: 'GHS',
        escrowMethod: 'mobile_money',
        description: 'Large deposit requiring approval',
      });

      if (result.success && result.data?.requiresApproval) {
        Alert.alert(
          'Approval Required',
          'Your deposit requires approval. Please check your pending approvals.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'View Approvals', onPress: () => setShowApprovals(true) },
          ]
        );
      } else if (result.success) {
        Alert.alert('Success', 'Deposit created successfully!');
      } else {
        Alert.alert('Error', result.error || 'Deposit failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create deposit');
    } finally {
      setLoading(false);
    }
  };

  // Example withdrawal with approval requirement
  const handleLargeWithdrawal = async () => {
    if (!activeCard) {
      Alert.alert('Error', 'No active card selected');
      return;
    }

    setLoading(true);
    try {
      const result = await makeTransaction({
        type: 'withdrawal',
        amount: 800, // Amount over 500 GHS will require biometric approval
        fromCardId: activeCard.id,
        description: 'Large withdrawal requiring approval',
      });

      if (result.success && result.requiresApproval) {
        Alert.alert(
          'Biometric Approval Required',
          'Your withdrawal requires biometric verification. Please check your pending approvals.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Verify Now', onPress: () => setShowApprovals(true) },
          ]
        );
      } else if (result.success) {
        Alert.alert('Success', 'Withdrawal processed successfully!');
      } else {
        Alert.alert('Error', result.error || 'Withdrawal failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  // Example transfer with approval requirement
  const handleLargeTransfer = async () => {
    if (!activeCard) {
      Alert.alert('Error', 'No active card selected');
      return;
    }

    setLoading(true);
    try {
      const result = await makeTransfer(
        activeCard.id,
        1200, // Amount over 1000 GHS will require PIN approval
        '1234567890123456', // Example recipient card number
        'Large transfer requiring approval'
      );

      if (result.success && result.requiresApproval) {
        Alert.alert(
          'PIN Approval Required',
          'Your transfer requires PIN verification. Please check your pending approvals.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Enter PIN', onPress: () => setShowApprovals(true) },
          ]
        );
      } else if (result.success) {
        Alert.alert('Success', 'Transfer completed successfully!');
      } else {
        Alert.alert('Error', result.error || 'Transfer failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process transfer');
    } finally {
      setLoading(false);
    }
  };

  // Handle approval completion (called by TransactionApproval component)
  const handleApprovalComplete = async (approved: boolean, approvalId?: string) => {
    try {
      if (approvalId) {
        // Call the context handler to update transaction status
        await handleApprovalStatusChange(approvalId, approved);
      }
      
      // Show feedback to user
      Alert.alert(
        approved ? 'Transaction Approved' : 'Transaction Rejected',
        approved 
          ? 'Your transaction has been approved and processed.'
          : 'Your transaction has been rejected.',
        [{ text: 'OK' }]
      );
      
      // Refresh the approvals count
      refreshPendingApprovals();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to process approval status');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header with approval badge */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction Approval Demo</Text>
        <ApprovalBadge style={styles.approvalBadge} />
      </View>

      {/* Pending approvals info */}
      <View style={styles.infoCard}>
        <MaterialIcons name="info" size={24} color="#007AFF" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Pending Approvals</Text>
          <Text style={styles.infoText}>
            You have {pendingApprovalsCount} pending approval{pendingApprovalsCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.viewButton}
          onPress={() => setShowApprovals(true)}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      </View>

      {/* Example actions that trigger approvals */}
      <View style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Try These Actions (Require Approval)</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.depositButton]}
          onPress={handleLargeDeposit}
          disabled={loading}
        >
          <MaterialIcons name="add-circle" size={24} color="white" />
          <Text style={styles.actionButtonText}>
            Large Deposit (₵1,500) - PIN Required
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.withdrawalButton]}
          onPress={handleLargeWithdrawal}
          disabled={loading}
        >
          <MaterialIcons name="remove-circle" size={24} color="white" />
          <Text style={styles.actionButtonText}>
            Large Withdrawal (₵800) - Biometric Required
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.transferButton]}
          onPress={handleLargeTransfer}
          disabled={loading}
        >
          <MaterialIcons name="swap-horiz" size={24} color="white" />
          <Text style={styles.actionButtonText}>
            Large Transfer (₵1,200) - PIN Required
          </Text>
        </TouchableOpacity>
      </View>

      {/* Usage instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionStep}>1.</Text>
          <Text style={styles.instructionText}>
            Transactions above certain thresholds require approval
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionStep}>2.</Text>
          <Text style={styles.instructionText}>
            Different verification methods: PIN, Biometric, OTP
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionStep}>3.</Text>
          <Text style={styles.instructionText}>
            Pending approvals appear in the badge and approval screen
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionStep}>4.</Text>
          <Text style={styles.instructionText}>
            Users can approve or reject pending transactions
          </Text>
        </View>
      </View>

      {/* Current approval thresholds */}
      <View style={styles.thresholdsCard}>
        <Text style={styles.sectionTitle}>Approval Thresholds</Text>
        <View style={styles.thresholdItem}>
          <Text style={styles.thresholdType}>Deposits</Text>
          <Text style={styles.thresholdValue}>&gt; ₵1,000 (PIN)</Text>
        </View>
        <View style={styles.thresholdItem}>
          <Text style={styles.thresholdType}>Withdrawals</Text>
          <Text style={styles.thresholdValue}>&gt; ₵500 (Biometric)</Text>
        </View>
        <View style={styles.thresholdItem}>
          <Text style={styles.thresholdType}>Transfers</Text>
          <Text style={styles.thresholdValue}>&gt; ₵1,000 (PIN)</Text>
        </View>
      </View>

      {/* Approval modal */}
      <TransactionApproval
        visible={showApprovals}
        onClose={() => setShowApprovals(false)}
        onApprovalComplete={handleApprovalComplete}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  approvalBadge: {
    marginRight: 0,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  actionsCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  depositButton: {
    backgroundColor: '#34C759',
  },
  withdrawalButton: {
    backgroundColor: '#FF3B30',
  },
  transferButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  instructionsCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionStep: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 12,
    width: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  thresholdsCard: {
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  thresholdItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  thresholdType: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  thresholdValue: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default ApprovalSystemExample;