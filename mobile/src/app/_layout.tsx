import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, SplashScreen, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/auth/session";
import { IncomingCallBanner } from "@/components/IncomingCallBanner";
import { IdentityAppearance } from '@/components/IdentityAppearance';
import { Aurora, Backdrop, Button, Txt } from "@/components/ui";
import { appHrefFromServerHref } from "@/lib/hrefs";
import { configureForegroundNotifications, registerPushDevice } from "@/lib/push";
import { useNotificationTap } from "@/lib/useNotificationTap";
import { useOnboardingRedirect } from "@/lib/useWelcome";
import { font, space, useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

/** Shown if a screen crashes, instead of a blank white page. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md }}>
      <Aurora />
      <Txt variant="title">Something broke</Txt>
      <Txt tone="muted" style={{ textAlign: "center" }}>{error.message}</Txt>
      <Button label="Try again" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  // Plus Jakarta Sans in the four weights the design uses (see `font` in src/theme).
  const [fontsLoaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  // One cache for the whole app. Data is treated as fresh for 30 s so switching tabs feels instant.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );

  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <IdentityAppearance><Navigation /></IdentityAppearance>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const theme = useTheme();
  const { status } = useSession();
  const lastResponse = useNotificationTap();
  // New accounts (and anyone who never finished onboarding) are sent to onboarding once.
  useOnboardingRedirect(status === "signedIn");

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  // Ask for notification permission once the person is signed in.
  useEffect(() => {
    if (status === "signedIn") void registerPushDevice();
  }, [status]);

  // Tapping a push notification opens the matching screen (also when the app was closed).
  useEffect(() => {
    if (status !== "signedIn" || !lastResponse) return;
    const href = (lastResponse.notification.request.content.data as { href?: string } | undefined)?.href;
    if (href) router.push(appHrefFromServerHref(href) as never);
  }, [status, lastResponse]);

  if (status === "loading") return null;

  return (
    <>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        // Every screen gets the calm background wash behind it. The tabs draw their own (one per tab).
        screenLayout={({ route, children }) => (route.name === "(tabs)" ? children : <Backdrop>{children}</Backdrop>)}
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontFamily: font.heavy, color: theme.ink },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        {/* Signed out: the Welcome screen comes first (it is the first screen they can see), then sign-in. */}
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === "needsAge"}>
          <Stack.Screen name="age" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="community/[slug]/index" options={{ headerShown: false }} />
          <Stack.Screen name="community/[slug]/post/[postId]" options={{ headerShown: false }} />
          <Stack.Screen name="community/[slug]/compose" options={{ title: "New post", presentation: "modal" }} />
          <Stack.Screen name="community/[slug]/wiki" options={{ title: "Wiki" }} />
          <Stack.Screen name="community/[slug]/events" options={{ title: "Events" }} />
          <Stack.Screen name="community/[slug]/rank" options={{ title: "Leaderboard" }} />
          <Stack.Screen name="community/[slug]/members" options={{ title: "Members" }} />
          <Stack.Screen name="community/[slug]/files" options={{ title: "Shared files" }} />
          <Stack.Screen name="community/[slug]/news" options={{ title: "News feed" }} />
          <Stack.Screen name="community/[slug]/look" options={{ title: "Community look" }} />
          <Stack.Screen name="community/[slug]/chats" options={{ title: "Chat rooms" }} />
          <Stack.Screen name="community/[slug]/mod" options={{ title: "Moderation" }} />
          <Stack.Screen name="community/[slug]/standing" options={{ title: "My standing" }} />
          <Stack.Screen name="community/[slug]/roleplay/index" options={{ title: "Stories" }} />
          <Stack.Screen name="community/[slug]/roleplay/[sceneId]" options={{ title: "Story" }} />
          <Stack.Screen name="chat/[roomId]" options={{ headerShown: false }} />
          <Stack.Screen name="call/[roomId]" options={{ title: "Call", presentation: "fullScreenModal" }} />
          <Stack.Screen name="profile/[handle]" options={{ headerShown: false }} />
          <Stack.Screen name="new-community" options={{ title: "New community", presentation: "modal" }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="saved" options={{ title: "Saved" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen name="safety" options={{ title: "Safety Center" }} />
          <Stack.Screen name="edit-profile" options={{ title: "Edit profile" }} />
          <Stack.Screen name="tools" options={{ title: "More tools" }} />
          <Stack.Screen name="security" options={{ title: "Account security" }} />
          <Stack.Screen name="privacy-dashboard" options={{ title: "Privacy & safety" }} />
          <Stack.Screen name="community/[slug]/tools" options={{ title: "Community tools" }} />
          <Stack.Screen name="content-studio" options={{ title: "Content studio" }} />
          <Stack.Screen name="profile-stories" options={{ title: "Profile stories" }} />
          <Stack.Screen name="inbox-tools" options={{ title: "Chat tools" }} />
          <Stack.Screen name="connections" options={{ title: "Connections" }} />
          <Stack.Screen name="groups/[roomId]" options={{ title: "Group settings" }} />
          <Stack.Screen name="media-library" options={{ title: "Media library" }} />
          <Stack.Screen name="short-videos" options={{ title: "Short videos", headerShown: false }} />
          <Stack.Screen name="smart-search" options={{ title: "Find your people" }} />
          <Stack.Screen name="operations" options={{ title: "Activity & safety" }} />
          <Stack.Screen name="admin-operations" options={{ title: "Operations dashboard" }} />
          <Stack.Screen name="admin-analytics" options={{ title: "Platform analytics" }} />
          <Stack.Screen name="profile-content" options={{ title: "Profile content" }} />
          <Stack.Screen name="tutorial" options={{ title: "Welcome tour" }} />
          <Stack.Screen name="invite/[code]" options={{ title: "Invitation" }} />
        </Stack.Protected>
        {/* Dev-only component gallery for visual checks (see src/app/kit.tsx). Not linked from anywhere. */}
        <Stack.Screen name="kit" options={{ headerShown: false }} />
        <Stack.Screen name="appeal" options={{ title: "Appeal a decision" }} />
      </Stack>
      {status === "signedIn" ? <IncomingCallBanner /> : null}
    </>
  );
}
