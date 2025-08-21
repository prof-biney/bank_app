import { Bell, CreditCard, TrendingUp, X } from "lucide-react-native";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

const mockNotifications = [
  {
    id: "1",
    title: "Payment Received",
    message: "You received $1,320.00 from Bank of America",
    time: "2 hours ago",
    type: "payment",
    unread: true,
  },
  {
    id: "2",
    title: "Card Transaction",
    message: "Gym Payment of $45.99 was processed",
    time: "1 day ago",
    type: "transaction",
    unread: true,
  },
  {
    id: "3",
    title: "Monthly Statement",
    message: "Your January statement is now available",
    time: "3 days ago",
    type: "statement",
    unread: false,
  },
];

export function NotificationModal({
  visible,
  onClose,
}: NotificationModalProps) {
  const { colors } = useTheme();
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <TrendingUp color="#10B981" size={20} />;
      case "transaction":
        return <CreditCard color="#0F766E" size={20} />;
      default:
        return <Bell color="#6B7280" size={20} />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }] }>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
            <X color={colors.textPrimary} size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.notificationsList}
          showsVerticalScrollIndicator={false}
        >
          {mockNotifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationItem, { backgroundColor: colors.card }]}
            >
              <View style={[styles.notificationIcon, { backgroundColor: colors.background }]}>
                {getNotificationIcon(notification.type)}
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                    {notification.title}
                  </Text>
                  {notification.unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
                  {notification.message}
                </Text>
                <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>{notification.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  notificationItem: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0F766E",
  },
  notificationMessage: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
