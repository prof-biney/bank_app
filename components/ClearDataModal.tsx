import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Trash2, AlertTriangle, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

interface ClearDataModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  dataType: 'transactions' | 'activity' | 'notifications' | 'payments' | 'all';
  count?: number;
  // New props for delayed deletion
  useDelayedDeletion?: boolean;
  delayMinutes?: number;
  onRestore?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export function ClearDataModal({ 
  visible, 
  onClose, 
  onConfirm, 
  isLoading = false, 
  dataType,
  count = 0,
  useDelayedDeletion = false,
  delayMinutes = 2,
  onRestore
}: ClearDataModalProps) {
  const { colors } = useTheme();
  const [scaleValue] = React.useState(new Animated.Value(0));
  const [opacityValue] = React.useState(new Animated.Value(0));
  
  // Timer state for delayed deletion
  const [isDelayActive, setIsDelayActive] = React.useState(false);
  const [remainingTime, setRemainingTime] = React.useState(0);
  const [intervalId, setIntervalId] = React.useState<NodeJS.Timeout | null>(null);

  // Start delayed deletion timer
  const startDelayedDeletion = () => {
    if (!useDelayedDeletion) {
      onConfirm();
      return;
    }
    
    setIsDelayActive(true);
    setRemainingTime(delayMinutes * 60); // Convert to seconds
    
    const id = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          // Time's up, execute the deletion
          clearInterval(id);
          setIntervalId(null);
          setIsDelayActive(false);
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setIntervalId(id);
  };
  
  // Stop timer and restore data
  const handleRestore = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsDelayActive(false);
    setRemainingTime(0);
    if (onRestore) {
      onRestore();
    }
    onClose();
  };
  
  // Clean up timer on unmount or close
  React.useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);
  
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Clean up timer when modal is hidden
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      setIsDelayActive(false);
      setRemainingTime(0);
      
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleValue, opacityValue, intervalId]);

  const handleBackdropPress = () => {
    if (!isLoading && !isDelayActive) {
      onClose();
    }
  };
  
  // Format remaining time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getContent = () => {
    if (isDelayActive) {
      return {
        title: 'Deletion Scheduled',
        description: `Your ${dataType} will be permanently deleted in ${formatTime(remainingTime)}. You can still restore your data by clicking the restore button below.`,
        actionText: 'Restore Data',
        icon: <AlertTriangle color={colors.warning} size={24} />
      };
    }
    
    switch (dataType) {
      case 'transactions':
        return {
          title: 'Clear All Transactions?',
          description: useDelayedDeletion 
            ? `This will schedule all ${count} transaction${count !== 1 ? 's' : ''} for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore them before permanent deletion.`
            : `This will permanently delete all ${count} transaction${count !== 1 ? 's' : ''} from your account. This action cannot be undone.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Transactions',
          icon: <Trash2 color={colors.negative} size={24} />
        };
      case 'activity':
        return {
          title: 'Clear All Activity?',
          description: useDelayedDeletion 
            ? `This will schedule all ${count} activity event${count !== 1 ? 's' : ''} for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore them before permanent deletion.`
            : `This will permanently delete all ${count} activity event${count !== 1 ? 's' : ''} from your history. This action cannot be undone.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Activity',
          icon: <Trash2 color={colors.negative} size={24} />
        };
      case 'notifications':
        return {
          title: 'Clear All Notifications?',
          description: useDelayedDeletion 
            ? `This will schedule all ${count} notification${count !== 1 ? 's' : ''} for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore them before permanent deletion.`
            : `This will permanently delete all ${count} notification${count !== 1 ? 's' : ''} from your account. This action cannot be undone.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Notifications',
          icon: <Trash2 color={colors.negative} size={24} />
        };
      case 'payments':
        return {
          title: 'Clear All Payments?',
          description: useDelayedDeletion 
            ? `This will schedule all ${count} payment${count !== 1 ? 's' : ''} for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore them before permanent deletion.`
            : `This will permanently delete all ${count} payment${count !== 1 ? 's' : ''} from your history. This action cannot be undone.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Payments',
          icon: <Trash2 color={colors.negative} size={24} />
        };
      case 'all':
        return {
          title: 'Clear All Data?',
          description: useDelayedDeletion 
            ? `This will schedule ALL your data for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore everything before permanent deletion.`
            : `This will permanently delete ALL your transactions, activity events, and notifications. This action cannot be undone and will reset your account.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Everything',
          icon: <Trash2 color={colors.negative} size={24} />
        };
      default:
        return {
          title: 'Clear Data?',
          description: useDelayedDeletion 
            ? `This will schedule the selected data for deletion in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}. You'll have time to restore it before permanent deletion.`
            : `This will permanently delete the selected data. This action cannot be undone.`,
          actionText: isLoading ? 'Clearing...' : useDelayedDeletion ? 'Schedule Deletion' : 'Clear Data',
          icon: <Trash2 color={colors.negative} size={24} />
        };
    }
  };

  const content = getContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: opacityValue,
          },
        ]}
      >
        {/* Fallback blur effect using semi-transparent overlay */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]} />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.negative + '15' }]}>
              <AlertTriangle color={colors.negative} size={24} />
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.background }]}
              onPress={onClose}
              disabled={isLoading}
            >
              <X color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {content.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {content.description}
            </Text>

            {count > 0 && !isDelayActive && (
              <View style={[styles.countContainer, { backgroundColor: colors.background }]}>
                <Text style={[styles.countText, { color: colors.textPrimary }]}>
                  {count} {dataType === 'transactions' ? 'transaction' : 
                         dataType === 'activity' ? 'activity event' :
                         dataType === 'notifications' ? 'notification' :
                         dataType === 'payments' ? 'payment' : 'item'}{count !== 1 ? 's' : ''} will be {useDelayedDeletion ? 'scheduled for deletion' : 'deleted'}
                </Text>
              </View>
            )}
            
            {isDelayActive && (
              <View style={[styles.timerContainer, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                <Text style={[styles.timerText, { color: colors.warning }]}>
                  ⏱️ Time remaining: {formatTime(remainingTime)}
                </Text>
                <Text style={[styles.timerSubtext, { color: colors.textSecondary }]}>
                  Data will be permanently deleted when timer reaches zero
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {isDelayActive ? (
              // Show restore and cancel options during delay period
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { backgroundColor: colors.background, borderColor: colors.border }
                  ]}
                  onPress={onClose}
                >
                  <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
                    Keep Running
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: colors.tintPrimary }
                  ]}
                  onPress={handleRestore}
                >
                  <Text style={[styles.buttonText, styles.confirmButtonText]}>
                    Restore Data
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              // Show normal confirm and cancel options
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { backgroundColor: colors.background, borderColor: colors.border }
                  ]}
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: colors.negative },
                    isLoading && { opacity: 0.7 }
                  ]}
                  onPress={startDelayedDeletion}
                  disabled={isLoading}
                >
                  <Text style={[styles.buttonText, styles.confirmButtonText]}>
                    {content.actionText}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Warning Notice */}
          <View style={[styles.notice, { backgroundColor: colors.background }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {isDelayActive 
                ? '⏳ You can restore your data before the timer runs out'
                : useDelayedDeletion 
                  ? `⏱️ You'll have ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''} to restore your data after scheduling deletion`
                  : '⚠️ This action is permanent and cannot be undone'
              }
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  countContainer: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: 'transparent',
  },
  confirmButton: {
    borderColor: 'transparent',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  notice: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noticeText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  timerContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timerSubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
