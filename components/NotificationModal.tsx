import { Bell, CreditCard, TrendingUp, X } from "lucide-react-native";
import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

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
      <View className="flex-1 bg-slate-50">
        <View className="flex-row justify-between items-center px-5 pt-5 pb-6 bg-white border-b border-slate-100">
          <Text className="text-xl font-bold text-gray-900">Notifications</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 justify-center items-center"
          >
            <X color="#374151" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {mockNotifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              className="flex-row bg-white rounded-xl p-4 mb-3 shadow-sm"
            >
              <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center mr-3">
                {getNotificationIcon(notification.type)}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-base font-semibold text-gray-900 flex-1">
                    {notification.title}
                  </Text>
                  {notification.unread && (
                    <View className="w-2 h-2 rounded-full bg-teal-700" />
                  )}
                </View>
                <Text className="text-sm text-gray-500 mb-1">
                  {notification.message}
                </Text>
                <Text className="text-xs text-gray-400">
                  {notification.time}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
