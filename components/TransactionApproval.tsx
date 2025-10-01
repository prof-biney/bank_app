import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getPendingApprovals,
  getApprovalById,
  approveTransaction,
  rejectTransaction,
  verifyPin,
  verifyBiometric,
  verifyOtp,
  ApprovalRequest,
} from '@/lib/appwrite/transactionApprovalService';
import { logger } from '@/lib/logger';

interface TransactionApprovalProps {
  visible: boolean;
  onClose: () => void;
  onApprovalComplete: (approved: boolean, approvalId?: string) => void;
  approvalId?: string; // If provided, shows specific approval; otherwise shows all pending
}

const TransactionApproval: React.FC<TransactionApprovalProps> = ({
  visible,
  onClose,
  onApprovalComplete,
  approvalId,
}) => {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [currentApproval, setCurrentApproval] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'list' | 'verify'>('list');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Load pending approvals when component mounts
  useEffect(() => {
    if (visible) {
      loadApprovals();
    }
  }, [visible, approvalId]);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      if (approvalId) {
        // Load specific approval
        const approval = await getApprovalById(approvalId);
        if (approval) {
          setCurrentApproval(approval);
          setPendingApprovals([approval]);
          setVerificationStep('verify');
        }
      } else {
        // Load all pending approvals
        const approvals = await getPendingApprovals();
        setPendingApprovals(approvals);
        setVerificationStep('list');
      }
    } catch (error) {
      logger.error('APPROVAL_UI', 'Failed to load approvals:', error);
      Alert.alert('Error', 'Failed to load pending approvals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalSelect = (approval: ApprovalRequest) => {
    setCurrentApproval(approval);
    setVerificationStep('verify');
  };

  const handleVerification = async () => {
    if (!currentApproval) return;

    setVerifying(true);
    try {
      let verified = false;

      switch (currentApproval.approvalType) {
        case 'pin':
          if (!pin) {
            Alert.alert('Error', 'Please enter your PIN');
            return;
          }
          verified = await verifyPin(pin);
          break;

        case 'biometric':
          verified = await verifyBiometric();
          break;

        case 'otp':
          if (!otp) {
            Alert.alert('Error', 'Please enter the OTP code');
            return;
          }
          verified = await verifyOtp(otp);
          break;

        default:
          verified = true; // For manual approvals
          break;
      }

      if (verified) {
        await handleApprove();
      } else {
        Alert.alert('Verification Failed', 'The verification was not successful. Please try again.');
      }
    } catch (error) {
      logger.error('APPROVAL_UI', 'Verification failed:', error);
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleApprove = async () => {
    if (!currentApproval) return;

    setVerifying(true);
    try {
      await approveTransaction(currentApproval.approvalId, 'User approved via mobile app');
      
      Alert.alert(
        'Transaction Approved',
        'The transaction has been successfully approved and will be processed.',
        [
          {
            text: 'OK',
            onPress: () => {
              onApprovalComplete(true, currentApproval.approvalId);
              handleClose();
            },
          },
        ]
      );
    } catch (error) {
      logger.error('APPROVAL_UI', 'Failed to approve transaction:', error);
      Alert.alert('Error', 'Failed to approve transaction. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!currentApproval) return;

    Alert.alert(
      'Reject Transaction',
      'Are you sure you want to reject this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setVerifying(true);
            try {
              await rejectTransaction(currentApproval.approvalId, 'User rejected via mobile app');
              
              Alert.alert(
                'Transaction Rejected',
                'The transaction has been rejected and will not be processed.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onApprovalComplete(false, currentApproval.approvalId);
                      handleClose();
                    },
                  },
                ]
              );
            } catch (error) {
              logger.error('APPROVAL_UI', 'Failed to reject transaction:', error);
              Alert.alert('Error', 'Failed to reject transaction. Please try again.');
            } finally {
              setVerifying(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setPin('');
    setOtp('');
    setCurrentApproval(null);
    setVerificationStep('list');
    onClose();
  };

  const renderApprovalItem = (approval: ApprovalRequest) => {
    const metadata = approval.metadata || {};
    const amount = metadata.amount || 0;
    const currency = metadata.currency || 'GHS';
    
    return (
      <TouchableOpacity
        key={approval.approvalId}
        style={styles.approvalItem}
        onPress={() => handleApprovalSelect(approval)}
      >
        <View style={styles.approvalHeader}>
          <MaterialIcons 
            name={getTransactionIcon(approval.transactionId)} 
            size={24} 
            color="#007AFF" 
          />
          <View style={styles.approvalInfo}>
            <Text style={styles.approvalTitle}>
              {getTransactionTitle(approval.transactionId)}
            </Text>
            <Text style={styles.approvalAmount}>
              {amount.toLocaleString('en-GH', { 
                style: 'currency', 
                currency: currency 
              })}
            </Text>
          </View>
          <View style={styles.approvalBadge}>
            <Text style={styles.approvalBadgeText}>
              {approval.approvalType.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <Text style={styles.approvalExpiry}>
          Expires: {new Date(approval.expiresAt).toLocaleString()}
        </Text>
        
        {metadata.description && (
          <Text style={styles.approvalDescription}>
            {metadata.description}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderVerificationStep = () => {
    if (!currentApproval) return null;

    const metadata = currentApproval.metadata || {};
    const amount = metadata.amount || 0;
    const currency = metadata.currency || 'GHS';

    return (
      <View style={styles.verificationContainer}>
        <Text style={styles.verificationTitle}>Approve Transaction</Text>
        
        <View style={styles.transactionSummary}>
          <Text style={styles.summaryAmount}>
            {amount.toLocaleString('en-GH', { 
              style: 'currency', 
              currency: currency 
            })}
          </Text>
          <Text style={styles.summaryDescription}>
            {metadata.description || 'Transaction approval required'}
          </Text>
        </View>

        {currentApproval.approvalType === 'pin' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Enter your PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              placeholder="Enter PIN"
            />
          </View>
        )}

        {currentApproval.approvalType === 'otp' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Enter OTP Code</Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              maxLength={6}
              placeholder="Enter OTP"
            />
          </View>
        )}

        {currentApproval.approvalType === 'biometric' && (
          <View style={styles.biometricContainer}>
            <MaterialIcons name="fingerprint" size={48} color="#007AFF" />
            <Text style={styles.biometricText}>
              Touch sensor to verify your identity
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
            disabled={verifying}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={handleVerification}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.approveButtonText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getTransactionIcon = (transactionId: string): keyof typeof MaterialIcons.glyphMap => {
    if (transactionId.includes('deposit')) return 'add-circle';
    if (transactionId.includes('withdrawal')) return 'remove-circle';
    if (transactionId.includes('transfer')) return 'swap-horiz';
    return 'account-balance-wallet';
  };

  const getTransactionTitle = (transactionId: string): string => {
    if (transactionId.includes('deposit')) return 'Deposit Approval';
    if (transactionId.includes('withdrawal')) return 'Withdrawal Approval';
    if (transactionId.includes('transfer')) return 'Transfer Approval';
    return 'Transaction Approval';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Transaction Approvals</Text>
          <TouchableOpacity onPress={handleClose}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading approvals...</Text>
          </View>
        ) : verificationStep === 'list' ? (
          <View style={styles.listContainer}>
            {pendingApprovals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="check-circle" size={64} color="#34C759" />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyMessage}>
                  You have no pending transaction approvals.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  Pending Approvals ({pendingApprovals.length})
                </Text>
                {pendingApprovals.map(renderApprovalItem)}
              </>
            )}
          </View>
        ) : (
          renderVerificationStep()
        )}
      </View>
    </Modal>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  approvalItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  approvalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  approvalAmount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  approvalBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approvalBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  approvalExpiry: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  approvalDescription: {
    fontSize: 14,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  verificationContainer: {
    flex: 1,
    padding: 20,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 32,
  },
  transactionSummary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  summaryDescription: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  pinInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  otpInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  biometricContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  biometricText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#007AFF',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionApproval;