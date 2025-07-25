import { Bell } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  const [showNotification, setShowNotification] = useState(false);

  return (
    <SafeAreaView>
      <ScrollView>
        <View className="flex-row justify-between items-center px-5 pt-5 pb-6">
          <View>
            <Text className="greeting">Welcome back!</Text>
            <Text className="username">Andrew Biney</Text>
          </View>
          <TouchableOpacity
            className="notification-button"
            onPress={() => setShowNotification(true)}
          >
            <Bell color="#374151" size={24} />
            <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
          </TouchableOpacity>
        </View>

        {/* Cards */}
        <View className="mb-8">{/* <BankCard /> */}</View>

        {/* Transactions */}
      </ScrollView>
    </SafeAreaView>
  );
}
