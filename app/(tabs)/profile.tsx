import { logger } from '@/lib/logger';
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import { navigateAfterLogout } from "@/lib/safeNavigation";
import {
  CircleHelp as HelpCircle,
  LogOut,
  Settings,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAlert } from '@/context/AlertContext';
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";
import { ProfilePicture } from "@/components/ProfilePicture";
import { ImagePickerModal } from "@/components/ImagePickerModal";
import { LogoutModal } from "@/components/LogoutModal";
import LoadingAnimation from '@/components/LoadingAnimation';
import { useLoading, LOADING_CONFIGS } from '@/hooks/useLoading';

export default function ProfileScreen() {
  const { user, logout, updateProfilePicture } = useAuthStore();
  const { showAlert } = useAlert();
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { loading, withLoading } = useLoading();

  const handleSignOut = () => {
    // Immediate UI response
    requestAnimationFrame(() => {
      setShowLogoutModal(true);
    });
  };

  const handleConfirmLogout = async () => {
    try {
      // Close modal immediately for better UX
      setShowLogoutModal(false);
      
      // Start loading indication
      await withLoading(async () => {
        await logout();
        await navigateAfterLogout('/sign-in');
      }, LOADING_CONFIGS.LOGOUT);
    } catch (error) {
      logger.error('SCREEN', 'Logout error:', error);
      showAlert('error', 'Failed to sign out. Please try again.', 'Error');
    }
  };

  const handleSettings = () => {
    // Immediate navigation with animation frame
    requestAnimationFrame(() => {
      router.push("/settings");
    });
  };

  const handleHelpSupport = () => {
    // Immediate navigation with animation frame
    requestAnimationFrame(() => {
      router.push("/help-support");
    });
  };

  const handleProfilePicturePress = () => {
    setShowImagePicker(true);
  };

  const handleImageSelected = async (imageUri: string) => {
    try {
      await withLoading(async () => {
        await updateProfilePicture(imageUri);
        showAlert('success', 'Profile picture updated successfully!', 'Success');
      }, LOADING_CONFIGS.UPLOAD_PHOTO);
    } catch (error) {
      logger.error('SCREEN', 'Profile picture update error:', error);
      showAlert('error', error instanceof Error ? error.message : 'Failed to update profile picture', 'Error');
    }
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
          <ProfilePicture
            name={user?.name}
            imageUrl={user?.avatar}
            size="large"
            editable
            loading={loading.visible}
            onPress={handleProfilePicturePress}
            style={styles.profilePicture}
          />
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.card }]}>
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={handleSettings}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <View style={styles.menuItemLeft}>
              <Settings color={colors.textSecondary} size={20} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Settings</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={handleHelpSupport}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <View style={styles.menuItemLeft}>
              <HelpCircle color={colors.textSecondary} size={20} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Help & Support</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={handleSignOut}
            activeOpacity={0.7}
            delayPressIn={0}
          >
            <View style={styles.menuItemLeft}>
              <LogOut color={colors.negative} size={20} />
              <Text style={[styles.menuItemText, { color: colors.negative }]}>
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImageSelected={handleImageSelected}
      />
      
      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        isLoading={false}
      />
      
      <LoadingAnimation
        visible={loading.visible}
        message={loading.message}
        subtitle={loading.subtitle}
        type={loading.type}
        size={loading.size}
      />
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
  profilePicture: {
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
