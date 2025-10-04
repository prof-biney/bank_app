import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, TouchableWithoutFeedback } from 'react-native';
import { ActivityEvent } from '@/types/activity';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Info, X, Trash2, AlertCircle, CheckCircle, Clock } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { activityLogger } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';
import ConfirmDialog from '@/components/modals/ConfirmDialog';

function getColors(event: ActivityEvent, themeColors: any) {
  const type = event.type?.toLowerCase() || '';
  const status = event.status?.toLowerCase() || '';
  const amount = event.amount || 0;
  
  // Determine if it's an error/failure state
  const isError = status.includes('failed') || type.includes('failed') || 
                  type.includes('deleted') || type.includes('removed') || 
                  status.includes('error') || status.includes('cancelled');
  
  // Determine if it's a success state
  const isSuccess = status.includes('completed') || status.includes('success') || 
                   type.includes('created') || type.includes('approved') || 
                   status.includes('active');
  
  // Determine if it's pending
  const isPending = status.includes('pending') || status.includes('processing') || 
                   status.includes('waiting');
  
  // For transactions, also consider income (green) vs expense (red)
  const isIncome = event.category === 'transaction' && amount > 0;
  const isExpense = event.category === 'transaction' && amount < 0;
  
  // Color definitions with stronger, more visible colors
  const errorRed = { 
    header: '#FCA5A5', // Light red
    footer: '#FCA5A5', 
    text: '#DC2626', // Dark red
    bg: '#FEE2E2' // Very light red background
  };
  
  const successGreen = { 
    header: '#86EFAC', // Light green  
    footer: '#86EFAC', 
    text: '#059669', // Dark green
    bg: '#ECFDF5' // Very light green background
  };
  
  const pendingYellow = { 
    header: '#FDE68A', // Light yellow
    footer: '#FDE68A', 
    text: '#D97706', // Dark orange
    bg: '#FFFBEB' // Very light yellow background
  };
  
  // Priority order: Error state > Income/Expense > Success/Pending
  if (isError || (isExpense && !isSuccess)) {
    return errorRed;
  }
  
  if (isIncome || isSuccess) {
    return successGreen;
  }
  
  if (isPending) {
    return pendingYellow;
  }
  
  // Default neutral using theme colors
  return { 
    header: themeColors.card, 
    footer: themeColors.card, 
    text: themeColors.textPrimary,
    bg: themeColors.card
  };
}

function getIcon(event: ActivityEvent, colors: any) {
  const status = event.status?.toLowerCase() || '';
  const type = event.type?.toLowerCase() || '';
  
  // Status-based icons (priority)
  if (status.includes('failed') || type.includes('failed') || status.includes('error')) {
    return <AlertCircle color={colors.text} size={20} />;
  }
  
  if (status.includes('completed') || status.includes('success')) {
    return <CheckCircle color={colors.text} size={20} />;
  }
  
  if (status.includes('pending') || status.includes('processing')) {
    return <Clock color={colors.text} size={20} />;
  }
  
  // Category-based icons (fallback)
  if (event.category === 'transaction') {
    if ((event.amount || 0) > 0) {
      return <ArrowDownLeft color={colors.text} size={20} />; // Income
    }
    return <ArrowUpRight color={colors.text} size={20} />; // Expense
  }
  
  if (event.category === 'card') {
    return <CreditCard color={colors.text} size={20} />;
  }
  
  return <Info color={colors.text} size={20} />;
}

export default function ActivityDetailModal({
  visible,
  event,
  onClose,
  onDelete,
}: {
  visible: boolean;
  event: ActivityEvent | null;
  onClose: () => void;
  onDelete?: (event: ActivityEvent) => void;
}) {
  const [payment, setPayment] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!event) return;
    
    setDeleting(true);
    try {
      // Delete from activityLogger storage
      await activityLogger.deleteActivity(event.id);
      // Call the onDelete prop to update the UI
      onDelete?.(event);
      onClose();
    } catch (error) {
      logger.error('ACTIVITY_MODAL', 'Failed to delete activity', { error, eventId: event.id });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  React.useEffect(() => {
    // When opened on a transaction event, fetch detailed payment info if transactionId is present
    async function fetchPayment() {
      if (!visible || !event) return;
      setPayment(null);
      setErr(null);
      if (event.category !== 'transaction' || !event.transactionId) return;
      
      try {
        setLoading(true);
        const { getApiBase } = require('@/lib/api');
        const { getValidJWT } = require('@/lib/jwt');
        
        // Get authentication token
        let jwt;
        try {
          jwt = await getValidJWT();
        } catch (jwtError) {
          logger.warn('ACTIVITY_MODAL', 'Could not get JWT token for payment details', jwtError);
        }
        
        const headers: any = {
          'Content-Type': 'application/json',
        };
        
        if (jwt) {
          headers['Authorization'] = `Bearer ${jwt}`;
        }
        
        const url = `${getApiBase()}/v1/payments/${event.transactionId}`;
        logger.info('ACTIVITY_MODAL', 'Fetching payment details', { transactionId: event.transactionId, url });
        
        const res = await fetch(url, { headers });
        
        if (!res.ok) {
          if (res.status === 404) {
            logger.info('ACTIVITY_MODAL', 'Payment details not found', { transactionId: event.transactionId });
            setErr('Payment details not found');
            return;
          }
          throw new Error(`Failed to fetch payment details (${res.status})`);
        }
        
        const data = await res.json();
        setPayment(data?.data || data || null);
        logger.info('ACTIVITY_MODAL', 'Payment details loaded successfully', { transactionId: event.transactionId });
      } catch (e: any) {
        logger.error('ACTIVITY_MODAL', 'Failed to fetch payment details', { error: e.message, transactionId: event.transactionId });
        setErr(e?.message || 'Payment details not available');
      } finally {
        setLoading(false);
      }
    }
    fetchPayment();
  }, [visible, event]);
  const { colors } = useTheme();
  if (!event) return null;

  const tone = getColors(event, colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: tone.header }]}> 
            <View style={styles.headerLeft}>
              {getIcon(event, tone)}
              <Text style={[styles.headerTitle, { color: tone.text }]} numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {onDelete && (
                <TouchableOpacity 
                  onPress={() => setShowDeleteConfirm(true)}
                  style={[styles.headerButton, { opacity: deleting ? 0.5 : 1 }]}
                  disabled={deleting}
                >
                  <Trash2 color={tone.text} size={18} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <X color={tone.text} size={18} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {/* Description */}
            {event.description ? (
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
                {event.description}
              </Text>
            ) : event.subtitle ? (
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{event.subtitle}</Text>
            ) : (
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>No additional details available.</Text>
            )}

            <View style={styles.detailsContainer}>
              {/* Amount with proper formatting */}
              {typeof event.amount === 'number' && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount:</Text>
                  <Text style={[styles.detailValue, { 
                    color: event.amount > 0 ? '#059669' : '#DC2626'
                  }]}>
                    {event.amount > 0 ? '+' : ''}{Math.abs(event.amount).toFixed(2)} {event.currency || 'GHS'}
                  </Text>
                </View>
              )}
              
              {/* Status with proper capitalization */}
              {event.status && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status:</Text>
                  <Text style={[styles.detailValue, { 
                    color: event.status.toLowerCase().includes('failed') ? '#DC2626' :
                           event.status.toLowerCase().includes('completed') ? '#059669' :
                           event.status.toLowerCase().includes('pending') ? '#D97706' :
                           colors.textPrimary
                  }]}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </Text>
                </View>
              )}
              
              {/* Transaction ID */}
              {event.transactionId && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={1}>
                    {event.transactionId}
                  </Text>
                </View>
              )}
              
              {/* Card ID */}
              {event.cardId && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Card ID:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={1}>
                    {event.cardId}
                  </Text>
                </View>
              )}
              
              {/* Mobile Number */}
              {(event.mobileNumber || event.metadata?.mobileNumber) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mobile Number:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {event.mobileNumber || event.metadata?.mobileNumber}
                  </Text>
                </View>
              )}
              
              {/* Mobile Network */}
              {(event.mobileNetwork || event.metadata?.mobileNetwork) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mobile Network:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {(event.mobileNetwork || event.metadata?.mobileNetwork)?.toUpperCase()}
                  </Text>
                </View>
              )}
              
              {/* Transaction Type */}
              {(event.tags?.length || event.type) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction Type:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {(() => {
                      // Format transaction type properly
                      const type = event.tags?.[0] || event.type || 'Unknown';
                      const category = event.category;
                      
                      // If it's a transaction category, format the type nicely
                      if (category === 'transaction') {
                        if (type.includes('deposit') || type === 'deposit') return 'Deposit';
                        if (type.includes('withdraw') || type === 'withdrawal' || type === 'withdraw') return 'Withdrawal';
                        if (type.includes('transfer') || type === 'transfer') return 'Transfer';
                        if (type.includes('payment') || type === 'payment') return 'Payment';
                      }
                      
                      // For other categories or unknown types, capitalize first letter
                      return type.charAt(0).toUpperCase() + type.slice(1);
                    })()} 
                  </Text>
                </View>
              )}
            </View>

            {/* Error display - prominent */}
            {err && (
              <View style={[styles.errorContainer, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
                <AlertCircle color="#DC2626" size={16} />
                <Text style={[styles.errorText, { color: '#DC2626' }]}>Error: {err}</Text>
              </View>
            )}
            
            {/* Loading state */}
            {loading && (
              <View style={styles.loadingContainer}>
                <Clock color={colors.textSecondary} size={16} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading payment details…</Text>
              </View>
            )}
            
            {/* Additional payment details from server */}
            {payment && (
              <View style={[styles.paymentDetails, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.paymentDetailsTitle, { color: colors.textPrimary }]}>Payment Details</Text>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Server Status:</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{payment.status}</Text>
                </View>
                {typeof payment.amount === 'number' && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Server Amount:</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{payment.amount} {payment.currency}</Text>
                  </View>
                )}
                {payment.capturedAt && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Captured At:</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(payment.capturedAt).toLocaleString()}</Text>
                  </View>
                )}
                {payment.refundedAt && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Refunded At:</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(payment.refundedAt).toLocaleString()}</Text>
                  </View>
                )}
              </View>
            )}

            {(() => {
              // Try to parse masked card last4 from subtitle like •••• 1234
              if (!event.subtitle) return null;
              const m = event.subtitle.match(/(\d{4})\s*$/);
              if (m) {
                return (
                  <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Card ending in {m[1]}</Text>
                );
              }
              return null;
            })()}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { backgroundColor: tone.footer }]}> 
            <Text style={[styles.footerText, { color: tone.text }]}>
              {new Date(event.timestamp).toLocaleString()}
            </Text>
          </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        disabled={deleting}
        leftIcon={<Trash2 color="#DC2626" size={20} />}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  paymentDetails: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  paymentDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  bodyMeta: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
