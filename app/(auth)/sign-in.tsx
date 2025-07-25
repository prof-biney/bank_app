import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const SignIn = () => {
  return (
    <View>
      <Text>Sign In</Text>

      <Link href="/sign-up">Goto Sign Up</Link>
    </View>
  );
};

export default SignIn;
