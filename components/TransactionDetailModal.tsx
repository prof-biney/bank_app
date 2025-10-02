import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, Edit3, Trash2, Check, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import type { Transaction } from '@/types/index';
import CustomButton from '@/components/CustomButton';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import { useAlert } from '@/context/AlertContext';

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onTransactionUpdated?: () => void;
  onTransactionDeleted?: () => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  onClose,
  onTransactionUpdated,
  onTransactionDeleted,
}: TransactionDetailModalProps) {
  const { colors } = useTheme();
  const { updateTransaction, deleteTransaction } = useApp();
  const { showAlert } = useAlert();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedStatus, setEditedStatus] = useState<'completed' | 'pending' | 'failed'>('completed');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    if (transaction && isEditing) {
      setEditedDescription(transaction.description);
      setEditedStatus(transaction.status);
    }
  }, [transaction, isEditing]);

  if (!transaction) return null;

  const handleStartEdit = () => {
    setEditedDescription(transaction.description);
    setEditedStatus(transaction.status);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDescription(transaction.description);
    setEditedStatus(transaction.status);
  };

  const handleSaveEdit = async () => {
    if (!editedDescription.trim()) {
      showAlert('error', 'Description cannot be empty', 'Error');
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateTransaction(transaction.id, {
        description: editedDescription.trim(),
        status: editedStatus,
      });

      if (result.success) {
        setIsEditing(false);
        onTransactionUpdated?.();
        showAlert('success', 'Transaction updated successfully', 'Success');
      } else {
        showAlert('error', result.error || 'Failed to update transaction', 'Error');
      }
    } catch (error) {
  showAlert('error', 'Failed to update transaction', 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteTransaction(transaction.id);

      if (result.success) {
  setShowDeleteConfirm(false);
  onTransactionDeleted?.();
  onClose();
  showAlert('success', 'Transaction deleted successfully', 'Success');
      } else {
  showAlert('error', result.error || 'Failed to delete transaction', 'Error');
      }
    } catch (error) {
  showAlert('error', 'Failed to delete transaction', 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.positive;
      case 'pending':
        return colors.warning;
      case 'failed':
        return colors.negative;
      default:
        return colors.textSecondary;
    }
  };

  const getAmountColor = (amount: number) => {
    return amount > 0 ? colors.positive : colors.negative;
  };

  const canEdit = ['pending', 'failed'].includes(transaction.status);
  const canDelete = !['completed'].includes(transaction.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Transaction Details
          </Text>
          <View style={styles.headerActions}>
            {canEdit && !isEditing && (
              <TouchableOpacity
                onPress={handleStartEdit}
                style={[styles.headerButton, { backgroundColor: colors.card }]}
              >
                <Edit3 color={colors.textSecondary} size={18} />
              </TouchableOpacity>
            )}
            {canDelete && !isEditing && (
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(true)}
                style={[styles.headerButton, { backgroundColor: colors.card }]}
              >
                <Trash2 color={colors.negative} size={18} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={isEditing ? handleCancelEdit : onClose}
              style={[styles.headerButton, { backgroundColor: colors.card }]}
            >
              <X color={colors.textPrimary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Amount */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Amount
            </Text>
            <Text style={[styles.amount, { color: getAmountColor(transaction.amount) }]}>
              {transaction.amount > 0 ? '+' : ''}
              {Math.abs(transaction.amount).toLocaleString('en-GH', {
                style: 'currency',
                currency: 'GHS'
              })}
            </Text>
          </View>

          {/* Description */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Description
            </Text>
            {isEditing ? (
              <TextInput
                style={[
                  styles.descriptionInput,
                  { 
                    color: colors.textPrimary, 
                    borderColor: colors.border,
                    backgroundColor: colors.background
                  }
                ]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Enter description"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            ) : (
              <Text style={[styles.description, { color: colors.textPrimary }]}>
                {transaction.description}
              </Text>
            )}
          </View>

          {/* Status */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Status
            </Text>
            {isEditing ? (
              <View style={styles.statusButtons}>
                {(['completed', 'pending', 'failed'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setEditedStatus(status)}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: editedStatus === status 
                          ? getStatusColor(status) 
                          : colors.background,
                        borderColor: getStatusColor(status),
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        {
                          color: editedStatus === status 
                            ? '#fff' 
                            : getStatusColor(status)
                        }
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.statusChip, { backgroundColor: getStatusColor(transaction.status) }]}>
                <Text style={[styles.statusText, { color: '#fff' }]}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Transaction Details */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Details
            </Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Type:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Category:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {transaction.category}
              </Text>
            </View>
            {transaction.recipient && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Recipient:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {transaction.recipient}
                </Text>
              </View>
            )}
            {transaction.mobileNumber && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Mobile Number:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {transaction.mobileNumber}
                </Text>
              </View>
            )}
            {transaction.mobileNetwork && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Mobile Network:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {transaction.mobileNetwork.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Date:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {new Date(transaction.date).toLocaleString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                ID:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: 12 }]}>
                {transaction.id}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save/Cancel buttons when editing */}
        {isEditing && (
          <View style={[styles.editActions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <CustomButton
              title="Cancel"
              variant="secondary"
              onPress={handleCancelEdit}
              style={[styles.editButton, { marginRight: 12 }]}
            />
            <CustomButton
              title={isUpdating ? "Saving..." : "Save Changes"}
              variant="primary"
              onPress={handleSaveEdit}
              disabled={isUpdating || !editedDescription.trim()}
              style={styles.editButton}
              leftIcon={!isUpdating ? <Check color="#fff" size={16} /> : undefined}
            />
          </View>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          visible={showDeleteConfirm}
          title="Delete Transaction"
          message={`Are you sure you want to permanently delete this ${transaction.type}? This action cannot be undone.`}
          confirmText={isDeleting ? "Deleting..." : "Delete"}
          cancelText="Cancel"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          disabled={isDeleting}
          leftIcon={<AlertTriangle color={colors.negative} size={16} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  descriptionInput: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  editActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
  },
  editButton: {
    flex: 1,
  },
});
