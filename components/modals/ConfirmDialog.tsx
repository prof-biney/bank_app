import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
  disabled = false,
  leftIcon,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();

  const headerBg = tone === 'danger' ? (isDark ? colors.errorBg : colors.errorBg)
    : tone === 'success' ? (isDark ? colors.successBg : colors.successBg)
    : colors.card;
  const headerText = tone === 'danger' ? colors.negative
    : tone === 'success' ? colors.positive
    : colors.textPrimary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }] }>
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}
            <Text style={[styles.title, { color: headerText }]}>{title}</Text>
          </View>
          <View style={styles.body}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={onCancel} disabled={disabled}>
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: tone === 'danger' ? colors.negative : tone === 'success' ? colors.positive : colors.tintPrimary }]}
              onPress={async () => { if (!disabled) await onConfirm(); }}
              disabled={disabled}
            >
              <Text style={[styles.btnText, { color: 'white' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 20 
  },
  container: { 
    width: '100%', 
    maxWidth: 420, 
    borderRadius: 16, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12
  },
  header: { 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    flex: 1, 
    marginLeft: 12 
  },
  body: { 
    paddingHorizontal: 20, 
    paddingVertical: 8,
    paddingBottom: 24 
  },
  message: { 
    fontSize: 15, 
    lineHeight: 22 
  },
  leftIconContainer: { 
    width: 28, 
    height: 28, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    paddingHorizontal: 16, 
    paddingVertical: 16,
    gap: 12
  },
  btn: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center'
  },
  btnText: { 
    fontSize: 15, 
    fontWeight: '600' 
  },
});

