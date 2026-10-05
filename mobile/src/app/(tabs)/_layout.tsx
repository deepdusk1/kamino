import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router/js-tabs";
import { api } from "@/api/endpoints";
import { BottomNav } from "@/components/k";
import { Backdrop } from "@/components/ui";
import { font, useTheme } from "@/theme";

/**
 * The five tabs, in this order: Home · Communities · (+) Create · Chats · Profile.
 * `BottomNav` draws the bar (icons come from the route names, labels from `title`; the `create` route is the raised
 * + button and opens the Create screen). Screens draw their own `AppHeader`, so the default headers are hidden.
 */
export default function TabsLayout() {
  const theme = useTheme();
  // Unread chats drive the red dot on Chats; refetched every minute while the app is open.
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms, refetchInterval: 60_000 });
  const unreadChats = (rooms.data ?? []).filter((r) => !r.muted).reduce((sum, r) => sum + r.unread, 0);

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenLayout={({ children }) => <Backdrop>{children}</Backdrop>}
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.heavy, color: theme.ink, fontSize: 22 },
        headerTitleAlign: "left",
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Communities" }} />
      <Tabs.Screen name="create" options={{ title: "Create" }} />
      <Tabs.Screen name="chats" options={{ title: "Chats", tabBarBadge: unreadChats > 0 ? Math.min(unreadChats, 99) : undefined }} />
      <Tabs.Screen name="me" options={{ title: "Profile" }} />
    </Tabs>
  );
}
