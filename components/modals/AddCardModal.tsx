import React from "react";
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { chooseReadableText } from "@/theme/color-utils";

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { number: string; name: string; exp_month: string; exp_year: string; cvc: string }) => void;
}

export default function AddCardModal({ visible, onClose, onSubmit }: AddCardModalProps) {
  const { isDark, colors } = useTheme();
  const [number, setNumber] = React.useState("");
  const [name, setName] = React.useState("");
  const [expMonth, setExpMonth] = React.useState("");
  const [expYear, setExpYear] = React.useState("");
  const [cvc, setCvc] = React.useState("");

  const formatCardNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 16); // max 16 digits
    const parts = digits.match(/.{1,4}/g) || [];
    return parts.join(" ");
  };

  const handleNumberChange = (val: string) => {
    setNumber(formatCardNumber(val));
  };

  const handleExpMonthChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 2);
    setExpMonth(digits);
  };

  const handleExpYearChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setExpYear(digits);
  };

  const handleCvcChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setCvc(digits);
  };

  const reset = () => {
    setNumber("");
    setName("");
    setExpMonth("");
    setExpYear("");
    setCvc("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    onSubmit({ number, name, exp_month: expMonth, exp_year: expYear, cvc });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(17,24,39,0.35)' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Add New Card</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enter Visa card details to add</Text>
          </View>

          <View style={styles.body}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Cardholder Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Card Number</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }
              ]}
              placeholder="4111 1111 1111 1111"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={number}
              onChangeText={handleNumberChange}
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Exp. Month</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }
                  ]}
                  placeholder="MM"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={expMonth}
                  onChangeText={handleExpMonthChange}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Exp. Year</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }
                  ]}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={expYear}
                  onChangeText={handleExpYearChange}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>CVC</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }
                  ]}
                  placeholder="CVC"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={cvc}
                  onChangeText={handleCvcChange}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.border }]} onPress={handleClose}>
              <Text style={[styles.buttonTextCancel, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.tintPrimary }]} onPress={handleSubmit}>
              <Text style={[styles.buttonText, { color: chooseReadableText(colors.tintPrimary) }]}>Add Card</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  body: {
    gap: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancel: {
  },
  confirm: {
  },
  buttonText: {
    fontWeight: '700',
  },
  buttonTextCancel: {
    fontWeight: '600',
  },
});

