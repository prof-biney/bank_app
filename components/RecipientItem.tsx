import { Check } from "lucide-react-native";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Recipient } from "@/types/index";
import { useTheme } from "@/context/ThemeContext";

interface RecipientItemProps {
  recipient: Recipient;
  selected?: boolean;
  onPress: () => void;
}

export function RecipientItem({
  recipient,
  selected,
  onPress,
}: RecipientItemProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: recipient.avatar }} style={styles.avatar} />
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.tintPrimary, borderColor: colors.background }] }>
            <Check color="white" size={16} />
          </View>
        )}
      </View>
      <Text style={[styles.name, { color: colors.textSecondary }]}>{recipient.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  selectedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
