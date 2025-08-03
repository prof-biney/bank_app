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

// Get screen width for positioning
const { width } = Dimensions.get('window');

// Component to display a single alert
const AlertItem = ({ alert, onHide }: { alert: AlertMessage; onHide: () => void }) => {
  // Animation value for slide in/out and fade
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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

    // If alert has a duration, slide out and fade out after duration
    if (alert.duration && alert.duration > 0) {
      const timer = setTimeout(() => {
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
          onHide();
        });
      }, alert.duration - 300); // Subtract animation duration

      return () => clearTimeout(timer);
    }
  }, [alert, onHide, translateY, opacity]);

  // Get icon and colors based on alert type
  const getAlertStyles = (type: AlertType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#ECFDF5',
          borderColor: '#10B981',
          icon: <CheckCircle color="#10B981" size={24} />,
          textColor: '#065F46',
        };
      case 'error':
        return {
          backgroundColor: '#FEF2F2',
          borderColor: '#EF4444',
          icon: <AlertCircle color="#EF4444" size={24} />,
          textColor: '#991B1B',
        };
      case 'warning':
        return {
          backgroundColor: '#FFFBEB',
          borderColor: '#F59E0B',
          icon: <AlertTriangle color="#F59E0B" size={24} />,
          textColor: '#92400E',
        };
      case 'info':
        return {
          backgroundColor: '#EFF6FF',
          borderColor: '#3B82F6',
          icon: <Info color="#3B82F6" size={24} />,
          textColor: '#1E40AF',
        };
      default:
        return {
          backgroundColor: '#F9FAFB',
          borderColor: '#6B7280',
          icon: <Info color="#6B7280" size={24} />,
          textColor: '#1F2937',
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