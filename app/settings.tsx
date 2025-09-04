import { router } from "expo-router";
import { ArrowLeft, Bell, Globe, Shield } from "lucide-react-native";
import React, { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { StyleSheet, Switch, Text, TouchableOpacity, View, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SettingsScreen() {
  const { colors, transitionStyle } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.card }]}
        >
          <ArrowLeft color={colors.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.themeToggleContainer}>
                <ThemeToggle size="small" />
              </View>
              <Text style={[styles.settingText, { color: colors.textSecondary }]}>Theme</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Bell color={colors.textSecondary} size={20} />
              <Text style={[styles.settingText, { color: colors.textSecondary }]}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.tintPrimary }}
              thumbColor={notificationsEnabled ? "#ffffff" : "#ffffff"}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Security</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Shield color={colors.textSecondary} size={20} />
              <Text style={[styles.settingText, { color: colors.textSecondary }]}>Biometric Authentication</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: colors.border, true: colors.tintPrimary }}
              thumbColor={biometricEnabled ? "#ffffff" : "#ffffff"}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>General</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Globe color={colors.textSecondary} size={20} />
              <Text style={[styles.settingText, { color: colors.textSecondary }]}>Language</Text>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>English</Text>
          </TouchableOpacity>
        </View>
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 16,
  },
  themeToggleContainer: {
    marginRight: -8, // Align with other icons
  },
});
