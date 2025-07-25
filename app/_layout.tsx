import { AppProvider } from "@/context/AppContext";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { AuthProvider } from "../context/AuthContext";
import "./global.css";

export default function RootLayout() {
  const [fontLoaded, eror] = useFonts({
    Inter: require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
    "inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "inter-Light": require("../assets/fonts/Inter-Light.ttf"),
  });

  useEffect(() => {
    if (eror) throw eror;
    if (!fontLoaded) SplashScreen.hideAsync();
  }, [fontLoaded, eror]);

  return (
    <AuthProvider>
      <AppProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProvider>
    </AuthProvider>
  );
}
