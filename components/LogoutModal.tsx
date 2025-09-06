
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
// import { BlurView } from 'expo-blur'; // Optional - fallback available
import { LogOut, AlertTriangle, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';


interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function LogoutModal({ visible, onClose, onConfirm, isLoading = false }: LogoutModalProps) {

  const { colors } = useTheme();
  const [scaleValue] = React.useState(new Animated.Value(0));
  const [opacityValue] = React.useState(new Animated.Value(0));

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
  }, [visible, scaleValue, opacityValue]);

  const handleBackdropPress = () => {
    if (!isLoading) {
      onClose();
    }
  };

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
              Sign Out?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Are you sure you want to sign out of your account? You'll need to sign in again to access your cards and transactions
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
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
              onPress={onConfirm}
              disabled={isLoading}
            >
              <View style={styles.buttonContent}>
                <LogOut color="#FFFFFF" size={16} />
                <Text style={[styles.buttonText, styles.confirmButtonText]}>
                  {isLoading ? 'Signing Out...' : 'Sign Out'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Security Notice */}
          <View style={[styles.notice, { backgroundColor: colors.background }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              💡 Your data will remain secure and accessible when you sign back in
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
  },
  confirmButtonText: {
    color: '#FFFFFF',
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
});
