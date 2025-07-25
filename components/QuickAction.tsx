import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

export function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity className="flex-1 text-center" onPress={onPress}>
      <View className="w-14 h-14 rounded-full bg-slate-100 justify-center items-center mb-2">
        {icon}
      </View>
      <Text className="text-base text-slate-700 font-medium">{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
});
