import { Check } from "lucide-react-native";
import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

interface DateFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFilter: string;
  onFilterSelect: (filter: string) => void;
}

const filterOptions = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export function DateFilterModal({
  visible,
  onClose,
  selectedFilter,
  onFilterSelect,
}: DateFilterModalProps) {
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
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-center items-center px-5"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="bg-white rounded-2xl p-5 w-full max-w-[300px]">
          <Text className="text-lg font-bold text-gray-800 text-center mb-4">
            Filter Transactions
          </Text>

          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              className="flex-row justify-between items-center py-4 border-b border-gray-100"
              onPress={() => handleFilterSelect(option.key)}
            >
              <Text className="text-base text-gray-700">{option.label}</Text>
              {selectedFilter === option.key && (
                <Check color="#0F766E" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
