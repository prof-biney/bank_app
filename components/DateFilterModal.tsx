import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";

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

          <View style={styles.chipRow}>
            {filterOptions.map((option) => {
              const tone = option.key === 'today' ? 'accent' : option.key === 'week' ? 'success' : option.key === 'month' ? 'warning' : option.key === 'year' ? 'accent' : 'neutral';
              const v = getBadgeVisuals(colors, { tone: tone as any, selected: selectedFilter === option.key, size: 'sm' });
              return (
                <View key={option.key} style={styles.chipItem}>
                  <CustomButton
                    onPress={() => handleFilterSelect(option.key)}
                    title={option.label}
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5, marginRight: 5, borderRadius: 18 }}
                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })}
          </View>
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
    flexWrap: 'wrap',
    gap: 0,
    paddingVertical: 4,
  },
  chipItem: {
    marginBottom: 8,
  },
});
