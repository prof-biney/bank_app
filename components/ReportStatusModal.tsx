/**
 * Report Status Modal
 * 
 * A beautiful modal component to show report generation success/failure status
 * with options for sharing and better user experience than basic alerts.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';
import { withAlpha } from '@/theme/color-utils';

const { width } = Dimensions.get('window');

export interface ReportStatusModalProps {
  visible: boolean;
  onClose: () => void;
  status: 'loading' | 'success' | 'error' | 'idle';
  reportFormat?: string;
  fileName?: string;
  onShare?: () => void;
  onRetry?: () => void;
  errorMessage?: string;
  loadingMessage?: string;
}

export default function ReportStatusModal({
  visible,
  onClose,
  status,
  reportFormat = 'CSV',
  fileName,
  onShare,
  onRetry,
  errorMessage,
  loadingMessage = 'Generating your report...'
}: ReportStatusModalProps) {
  const { colors } = useTheme();

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'loading':
        return null; // We'll show ActivityIndicator instead
      default:
        return 'document-text';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'loading':
        return colors.tintPrimary;
      default:
        return colors.tintPrimary;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'success':
        return 'Report Generated Successfully! 🎉';
      case 'error':
        return 'Report Generation Failed';
      case 'loading':
        return 'Generating Report';
      default:
        return 'Report Status';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'success':
        return `Your ${reportFormat.toUpperCase()} report has been generated and is ready to share or view.${fileName ? `\n\nFile: ${fileName}` : ''}`;
      case 'error':
        return errorMessage || 'We encountered an error while generating your report. Please try again.';
      case 'loading':
        return loadingMessage;
      default:
        return 'Preparing your financial report...';
    }
  };

  const renderContent = () => {
    return (
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        {/* Status Icon/Indicator */}
        <View style={[styles.statusIconContainer, { backgroundColor: withAlpha(getStatusColor(), 0.1) }]}>
          {status === 'loading' ? (
            <ActivityIndicator size="large" color={getStatusColor()} />
          ) : (
            <Ionicons
              name={getStatusIcon() as any}
              size={64}
              color={getStatusColor()}
            />
          )}
        </View>

        {/* Status Title */}
        <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
          {getStatusTitle()}
        </Text>

        {/* Status Message */}
        <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
          {getStatusMessage()}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {status === 'success' && (
            <>
              {onShare && (
                <LinearGradient
                  colors={[colors.tintPrimary, withAlpha(colors.tintPrimary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  <TouchableOpacity
                    style={styles.buttonInner}
                    onPress={onShare}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Share Report</Text>
                  </TouchableOpacity>
                </LinearGradient>
              )}
              
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'error' && (
            <>
              {onRetry && (
                <LinearGradient
                  colors={[colors.tintPrimary, withAlpha(colors.tintPrimary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  <TouchableOpacity
                    style={styles.buttonInner}
                    onPress={onRetry}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </LinearGradient>
              )}
              
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'loading' && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={status !== 'loading' ? onClose : undefined}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: withAlpha('#000000', 0.5) }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={status !== 'loading' ? onClose : undefined}
          >
            <View style={styles.modalWrapper} onStartShouldSetResponder={() => true}>
              {renderContent()}
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  statusMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});