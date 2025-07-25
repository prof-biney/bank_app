import { Redirect } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

export default function TabLayout() {
  const isAuthenticated = false; // Replace with actual authentication logic

  if (!isAuthenticated) return <Redirect href="/sign-in" />;

  return (
    <View>
      <Text>Tab Layout</Text>
    </View>
  );
}
