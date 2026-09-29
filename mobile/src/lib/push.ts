import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/api/endpoints";
import { deleteSecret, readSecret, writeSecret } from "@/auth/storage";

const PUSH_TOKEN_KEY = "kamino.push-token";

/** How notifications look while the app is open: a banner, no sound spam. */
export function configureForegroundNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks for permission (once), gets this phone's push address, and tells the Kamino server.
 * Returns a short status the Settings screen can show. Never throws.
 */
export async function registerPushDevice(): Promise<"enabled" | "denied" | "unsupported"> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return "unsupported"; // simulators cannot receive push

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Kamino",
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: "#6947d5",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return "denied";

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return "unsupported"; // set up by `npx eas-cli init`; see README

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPush(token, Platform.OS === "ios" ? "ios" : "android");
    await writeSecret(PUSH_TOKEN_KEY, token);
    return "enabled";
  } catch {
    return "unsupported";
  }
}

/** Called on sign-out so the next person to use this phone does not receive your notifications. */
export async function unregisterPushDevice(): Promise<void> {
  const token = await readSecret(PUSH_TOKEN_KEY);
  if (!token) return;
  await api.unregisterPush(token).catch(() => undefined);
  await deleteSecret(PUSH_TOKEN_KEY);
}
