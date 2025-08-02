import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { usePaystack } from "react-native-paystack-webview";

const PaystackPayment = () => {
  const { popup } = usePaystack();

  const paystackPayment = () => {
    popup.newTransaction({
      email: "abiney1321@gmail.com",
      amount: 5000,
      reference: `TXN_${Date.now()}`,
      onSuccess: async () => {
        console.log("Success");
      },
      onCancel: () => {
        console.log("Cancelled");
      },
      onError: (err) => {
        console.log("Error", err.message);
      },
      onLoad: () => {
        console.log("Webview Loading");
      },
    });
  };

  return (
    <View className="flex-center mb-5 w-full px-12">
      <TouchableOpacity
        onPress={paystackPayment}
        className="rounded-full bg-teal-700 py-3 px-6"
      >
        <Text className="text-white font-semibold"> Paystack Payment </Text>
      </TouchableOpacity>
    </View>
  );
};

export default PaystackPayment;
