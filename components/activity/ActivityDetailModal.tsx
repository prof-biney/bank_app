import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, TouchableWithoutFeedback } from 'react-native';
import { ActivityEvent } from '@/types/activity';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Info, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

function getColors(type: string | undefined, category: ActivityEvent['category'], themeColors: any) {
  // Determine tone based on status/type
  const isError = type?.includes('failed') || type?.includes('removed') || type?.includes('delete');
  const isSuccess = type?.includes('success') || type?.includes('approved') || type?.includes('added') || type?.includes('created');
  const isPending = type?.includes('pending') || type?.includes('unapproved') || type?.includes('await');

  // Use softer tones in dark mode by blending with background
  const error = { header: themeColors.tintErrorBg || '#FEE2E2', footer: themeColors.tintErrorBg || '#FEE2E2', text: themeColors.tintErrorText || '#991B1B' };
  const success = { header: themeColors.tintSuccessBg || '#ECFDF5', footer: themeColors.tintSuccessBg || '#ECFDF5', text: themeColors.tintSuccessText || '#065F46' };
  const pending = { header: themeColors.tintPendingBg || '#FFFBEB', footer: themeColors.tintPendingBg || '#FFFBEB', text: themeColors.tintPendingText || '#92400E' };

  if (isError) return error;
  if (isSuccess) return success;
  if (isPending) return pending;
  // Default neutral header/footer using card color
  return { header: themeColors.card, footer: themeColors.card, text: themeColors.textPrimary };
}

function getIcon(evt: ActivityEvent, themeColors: any) {
  if (evt.category === 'transaction') {
    if ((evt.amount || 0) > 0) return <ArrowDownLeft color={themeColors.positive || '#10B981'} size={20} />;
    return <ArrowUpRight color={themeColors.negative || '#EF4444'} size={20} />;
  }
  if (evt.category === 'card') return <CreditCard color={themeColors.textSecondary} size={20} />;
  return <Info color={themeColors.textSecondary} size={20} />;
}

export default function ActivityDetailModal({
  visible,
  event,
  onClose,
}: {
  visible: boolean;
  event: ActivityEvent | null;
  onClose: () => void;
}) {
  const [payment, setPayment] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

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
        const url = `${getApiBase()}/v1/payments`;
        const jwt = (global as any).__APPWRITE_JWT__ || undefined;
        const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
const found = Array.isArray(data?.data) ? data.data.find((p: any) => p.id === event.transactionId) : null;
        setPayment(found || null);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load payment');
      } finally {
        setLoading(false);
      }
    }
    fetchPayment();
  }, [visible, event]);
  const { colors } = useTheme();
  if (!event) return null;

  const tone = getColors(event.type, event.category, colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: tone.header }]}> 
            <View style={styles.headerLeft}>
              {getIcon(event, colors)}
              <Text style={[styles.headerTitle, { color: tone.text }]} numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X color={tone.text} size={18} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {event.subtitle ? (
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{event.subtitle}</Text>
            ) : (
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>No additional details.</Text>
            )}

            {/* Structured fields from event */}
            {typeof event.amount === 'number' && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Amount: {event.amount > 0 ? '+' : ''}{Math.abs(event.amount).toFixed(2)} {event.currency || 'GHS'}</Text>
            )}
            {!!event.status && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Status: {event.status}</Text>
            )}
            {!!event.tags?.length && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Category: {event.tags[0]}</Text>
            )}
            {!!event.transactionId && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Transaction ID: {event.transactionId}</Text>
            )}
            {!!event.cardId && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Card ID: {event.cardId}</Text>
            )}

            {/* Extra details from server payment document */}
            {loading && (
              <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Loading payment details…</Text>
            )}
            {err && (
              <Text style={[styles.bodyMeta, { color: colors.negative }]}>Error: {err}</Text>
            )}
            {payment && (
              <View style={{ marginTop: 6 }}>
                <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Server Status: {payment.status}</Text>
                {typeof payment.amount === 'number' && (
                  <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Server Amount: {payment.amount} {payment.currency}</Text>
                )}
                {payment.capturedAt && (
                  <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Captured At: {new Date(payment.capturedAt).toLocaleString()}</Text>
                )}
                {payment.refundedAt && (
                  <Text style={[styles.bodyMeta, { color: colors.textSecondary }]}>Refunded At: {new Date(payment.refundedAt).toLocaleString()}</Text>
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
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
