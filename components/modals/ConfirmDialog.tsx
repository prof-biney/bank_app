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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  container: { width: '100%', maxWidth: 420, borderRadius: 12, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 16 },
  message: { fontSize: 14 },
  leftIconContainer: { position: 'absolute', left: 12, top: 12 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingVertical: 12 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { fontSize: 14, fontWeight: '600' },
});

