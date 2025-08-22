import { AlertMessage, AlertType, useAlert } from '@/context/AlertContext';
import { CheckCircle, Info, X, AlertTriangle, AlertCircle } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { 
  Animated, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  Dimensions
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { withAlpha } from '@/theme/color-utils';

// Get screen width for positioning
const { width } = Dimensions.get('window');

// Component to display a single alert
const AlertItem = ({ alert, onHide }: { alert: AlertMessage; onHide: () => void }) => {
  // Animation value for slide in/out and fade
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Split the animations into separate effects to avoid scheduling updates during render
  
  // Handle entrance animation
  useEffect(() => {
    // Slide in and fade in animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  // Handle auto-dismissal separately
  useEffect(() => {
    // Only set up the timer if the alert has a duration
    if (!alert.duration || alert.duration <= 0) {
      return;
    }
    
    // Create a reference to track if the component is still mounted
    let isMounted = true;
    
    // Set up the timer for auto-dismissal
    const timer = setTimeout(() => {
      // Only proceed if the component is still mounted
      if (isMounted) {
        // Start the exit animation
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Only call onHide if the component is still mounted
          if (isMounted) {
            onHide();
          }
        });
      }
    }, alert.duration - 300); // Subtract animation duration

    // Clean up function to prevent memory leaks and updates on unmounted components
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [alert.duration, onHide, translateY, opacity]);

  const { colors } = useTheme();
  // Get icon and colors based on alert type
  const getAlertStyles = (type: AlertType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.successBg,
          borderColor: colors.positive,
          icon: <CheckCircle color={colors.positive} size={24} />,
          textColor: colors.positive,
        };
      case 'error':
        return {
          backgroundColor: colors.errorBg,
          borderColor: colors.negative,
          icon: <AlertCircle color={colors.negative} size={24} />,
          textColor: colors.negative,
        };
      case 'warning':
        return {
          backgroundColor: colors.warningBg,
          borderColor: colors.warning,
          icon: <AlertTriangle color={colors.warning} size={24} />,
          textColor: colors.warning,
        };
      case 'info':
        return {
          backgroundColor: withAlpha(colors.tintPrimary, 0.12),
          borderColor: colors.tintPrimary,
          icon: <Info color={colors.tintPrimary} size={24} />,
          textColor: colors.textPrimary,
        };
      default:
        return {
          backgroundColor: colors.card,
          borderColor: colors.border,
          icon: <Info color={colors.textSecondary} size={24} />,
          textColor: colors.textPrimary,
        };
    }
  };

  const alertStyles = getAlertStyles(alert.type);

  return (
    <Animated.View
      style={[
        styles.alertContainer,
        {
          backgroundColor: alertStyles.backgroundColor,
          borderLeftColor: alertStyles.borderColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.iconContainer}>{alertStyles.icon}</View>
      <View style={styles.contentContainer}>
        {alert.title && (
          <Text style={[styles.title, { color: alertStyles.textColor }]}>
            {alert.title}
          </Text>
        )}
        <Text style={[styles.message, { color: alertStyles.textColor }]}>
          {alert.message}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onHide}>
        <X color={alertStyles.textColor} size={18} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main Alert component that renders all alerts
export function Alert() {
  const { alerts, hideAlert } = useAlert();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onHide={() => hideAlert(alert.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    paddingTop: 50, // Adjust based on safe area
  },
  alertContainer: {
    width: width - 32, // Full width minus padding
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
});