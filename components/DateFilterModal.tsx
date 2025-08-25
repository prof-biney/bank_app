import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Check } from "lucide-react-native";

interface DateFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFilter: string;
  onFilterSelect: (filter: string) => void;
}

const filterOptions = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
];

export function DateFilterModal({
  visible,
  onClose,
  selectedFilter,
  onFilterSelect,
}: DateFilterModalProps) {
  const { colors } = useTheme();

  const handleFilterSelect = (filter: string) => {
    onFilterSelect(filter);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Filter Transactions</Text>

          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.option, { borderBottomColor: colors.border }]}
              onPress={() => handleFilterSelect(option.key)}
            >
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>{option.label}</Text>
              {selectedFilter === option.key && (
                <Check color={colors.tintPrimary} size={20} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modal: {
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 0,
    paddingVertical: 4,
  },
  chipItem: {
    marginBottom: 8,
  },
});
