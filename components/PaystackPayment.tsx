import { useAlert } from "@/context/AlertContext";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { usePaystack } from "react-native-paystack-webview";

const PaystackPayment = () => {
  const { popup } = usePaystack();
  const { showAlert } = useAlert();
  const [configValid, setConfigValid] = useState(true);

  // Check for required environment variables on component mount
  useEffect(() => {
    const requiredEnvVars = ["EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY"];
    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      console.warn(
        `Missing required Paystack environment variables: ${missingEnvVars.join(", ")}`
      );
      console.warn(
        "Please check your .env file and make sure all required variables are defined."
      );
      setConfigValid(false);
    }
  }, []);

  const paystackPayment = () => {
    // If configuration is invalid, show an alert and return
    if (!configValid) {
      showAlert(
        "error",
        "Paystack is not properly configured. Please check the application logs for details.",
        "Configuration Error"
      );
      return;
    }

    // Get configuration from environment variables with fallbacks
    const defaultEmail =
      process.env.EXPO_PUBLIC_PAYSTACK_DEFAULT_EMAIL || "abiney1321@gmail.com";

    popup.newTransaction({
      email: defaultEmail,
      amount: 5000,
      reference: `TXN_${Date.now()}`,
      onSuccess: async () => {
        console.log("Payment successful");
        showAlert(
          "success",
          "Your payment was processed successfully.",
          "Payment Successful"
        );
      },
      onCancel: () => {
        console.log("Payment cancelled");
        showAlert("info", "Your payment was cancelled.", "Payment Cancelled");
      },
      onError: (err) => {
        console.error("Payment error:", err.message);
        showAlert("error", `Payment failed: ${err.message}`, "Payment Error");
      },
      onLoad: () => {
        console.log("Paystack webview loading");
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
