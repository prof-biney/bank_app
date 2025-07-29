import { router } from "expo-router";
import { ArrowLeft, Bell, Globe, Moon, Shield } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Bell color="#374151" size={20} />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#D1D5DB", true: "#0F766E" }}
              thumbColor={notificationsEnabled ? "#ffffff" : "#ffffff"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Moon color="#374151" size={20} />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: "#D1D5DB", true: "#0F766E" }}
              thumbColor={darkModeEnabled ? "#ffffff" : "#ffffff"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Shield color="#374151" size={20} />
              <Text style={styles.settingText}>Biometric Authentication</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: "#D1D5DB", true: "#0F766E" }}
              thumbColor={biometricEnabled ? "#ffffff" : "#ffffff"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Globe color="#374151" size={20} />
              <Text style={styles.settingText}>Language</Text>
            </View>
            <Text style={styles.settingValue}>English</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: "white",
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
    color: "#1F2937",
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
    color: "#374151",
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 16,
    color: "#6B7280",
  },
});
