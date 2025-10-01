/**
 * ThemeToggle Component
 * 
 * A beautiful theme toggle component that allows users to switch between
 * light, dark, and system themes with smooth animations and intuitive icons.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { useTheme, ThemeMode } from '@/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { withAlpha } from '@/theme/color-utils';

interface ThemeToggleProps {
  style?: any;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    mode: 'light',
    label: 'Light',
    icon: 'wb-sunny',
    description: 'Always use light theme',
  },
  {
    mode: 'dark',
    label: 'Dark',
    icon: 'brightness-2',
    description: 'Always use dark theme',
  },
  {
    mode: 'system',
    label: 'System',
    icon: 'brightness-auto',
    description: 'Use system preference',
  },
];

export function ThemeToggle({ style, showLabel = false, size = 'medium' }: ThemeToggleProps) {
  const { isDark, themeMode, colors, setThemeMode } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const getSizes = () => {
    switch (size) {
      case 'small':
        return { iconSize: 18, containerSize: 36, fontSize: 12 };
      case 'large':
        return { iconSize: 28, containerSize: 56, fontSize: 16 };
      default:
        return { iconSize: 24, containerSize: 48, fontSize: 14 };
    }
  };

  const sizes = getSizes();

  const getCurrentIcon = () => {
    switch (themeMode) {
      case 'light':
        return 'wb-sunny';
      case 'dark':
        return 'brightness-2';
      default:
        return 'brightness-auto';
    }
  };

  const handlePress = () => {
    // Add press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setShowModal(true);
  };

  const selectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setShowModal(false);
  };

  const ThemeOption = ({ option }: { option: ThemeOption }) => {
    const isSelected = themeMode === option.mode;
    
    return (
      <TouchableOpacity
        style={[
          styles.optionContainer,
          {
            backgroundColor: isSelected ? colors.tintSoftBg : 'transparent',
            borderColor: isSelected ? colors.tintPrimary : colors.border,
          }
        ]}
        onPress={() => selectTheme(option.mode)}
        activeOpacity={0.7}
      >
        <View style={styles.optionLeft}>
          <View
            style={[
              styles.optionIconContainer,
              {
                backgroundColor: isSelected ? colors.tintPrimary : colors.surface,
              }
            ]}
          >
            <MaterialIcons
              name={option.icon as any}
              size={22}
              color={isSelected ? colors.textInverse : colors.tintPrimary}
            />
          </View>
          <View style={styles.optionTextContainer}>
            <Text
              style={[
                styles.optionLabel,
                {
                  color: colors.textPrimary,
                  fontWeight: isSelected ? '600' : '500',
                }
              ]}
            >
              {option.label}
            </Text>
            <Text
              style={[
                styles.optionDescription,
                { color: colors.textSecondary }
              ]}
            >
              {option.description}
            </Text>
          </View>
        </View>
        {isSelected && (
          <MaterialIcons
            name="check-circle"
            size={20}
            color={colors.tintPrimary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.container, style]}>
        <Animated.View
          style={[
            styles.toggleButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              width: sizes.containerSize,
              height: sizes.containerSize,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <TouchableOpacity
            style={styles.touchable}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={getCurrentIcon() as any}
              size={sizes.iconSize}
              color={colors.tintPrimary}
            />
          </TouchableOpacity>
        </Animated.View>
        {showLabel && (
          <Text
            style={[
              styles.label,
              {
                color: colors.textSecondary,
                fontSize: sizes.fontSize,
              }
            ]}
          >
            {themeOptions.find(opt => opt.mode === themeMode)?.label}
          </Text>
        )}
      </View>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Theme Preference
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.optionsContainer}>
              {themeOptions.map((option) => (
                <ThemeOption key={option.mode} option={option} />
              ))}
            </View>
            
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                Your preference will be saved and applied across the app
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  toggleButton: {
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  touchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    paddingHorizontal: 20,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 4,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
