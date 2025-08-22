import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import {
  CircleHelp as HelpCircle,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          logout();
          router.replace("/sign-in");
        },
      },
    ]);
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  const handleHelpSupport = () => {
    router.push("/help-support");
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
        </View>

        <View style={[styles.userSection, { backgroundColor: colors.card }]}>
          <View style={[styles.avatar, { backgroundColor: colors.background }]}>
            <UserIcon color={colors.tintPrimary} size={32} />
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleSettings}>
            <View style={styles.menuItemLeft}>
              <Settings color={colors.textSecondary} size={20} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Settings</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleHelpSupport}>
            <View style={styles.menuItemLeft}>
              <HelpCircle color={colors.textSecondary} size={20} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Help & Support</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleSignOut}>
            <View style={styles.menuItemLeft}>
              <LogOut color={colors.negative} size={20} />
              <Text style={[styles.menuItemText, { color: colors.negative }] }>
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  userSection: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  menuSection: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: "500",
  },
});
