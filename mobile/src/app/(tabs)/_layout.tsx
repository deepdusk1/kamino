import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { type ColorValue } from "react-native";
import { api } from "@/api/endpoints";
import { Backdrop, GlassTabBar, PressableScale } from "@/components/ui";
import { font, useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (active: IconName, inactive: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };

export default function TabsLayout() {
  const theme = useTheme();
  // Unread counts drive the badges; refetched every minute while the app is open.
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms, refetchInterval: 60_000 });
  const unreadChats = (rooms.data ?? []).filter((r) => !r.muted).reduce((sum, r) => sum + r.unread, 0);

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenLayout={({ children }) => <Backdrop>{children}</Backdrop>}
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.heavy, color: theme.fg, fontSize: 22 },
        headerTitleAlign: "left",
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("compass", "compass-outline") }} />
      <Tabs.Screen
        name="create"
        options={{ title: "Create", tabBarIcon: icon("add-circle", "add-circle-outline") }}
        listeners={{ tabPress: (event) => { event.preventDefault(); router.push("/new-community"); } }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: "Chats", tabBarIcon: icon("chatbubbles", "chatbubbles-outline"), tabBarBadge: unreadChats > 0 ? Math.min(unreadChats, 99) : undefined }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: icon("person-circle", "person-circle-outline"),
          headerRight: () => (
            <PressableScale onPress={() => router.push("/settings")} accessibilityLabel="Settings" style={{ paddingHorizontal: 16 }} scaleTo={0.85}>
              <Ionicons name="settings-outline" size={22} color={theme.fg} />
            </PressableScale>
          ),
        }}
      />
    </Tabs>
  );
}
