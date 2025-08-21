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
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tones = {
    default: { header: '#F3F4F6', text: '#111827' },
    danger: { header: '#FEE2E2', text: '#991B1B' },
    success: { header: '#ECFDF5', text: '#065F46' },
  } as const;

  const t = tones[tone] || tones.default;
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }] }>
          <View style={[styles.header, { backgroundColor: isDark ? colors.card : t.header }]}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          </View>
          <View style={styles.body}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: isDark ? '#262626' : '#F3F4F6' }]} onPress={onCancel}>
              <Text style={[styles.btnText, { color: isDark ? '#E5E7EB' : '#374151' }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#E5E7EB' }]} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: '#111827' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  container: { width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 16 },
  message: { fontSize: 14, color: '#374151' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  cancel: { backgroundColor: '#F3F4F6' },
  confirm: { backgroundColor: '#E5E7EB' },
  btnText: { fontSize: 14, fontWeight: '600' },
});

