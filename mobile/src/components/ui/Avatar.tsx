import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { apiBaseUrl } from "@/api/config";
import { frameLook } from "@/lib/cosmetics";
import { font, hueGradient, useTheme } from "@/theme";
import { Txt } from "./Txt";

type Props = {
  name: string;
  hue: number;
  size?: number;
  /** With `version`, shows the person's profile photo instead of their initial. */
  userId?: string;
  /** The photo version the server reports (0 or missing = no photo). */
  version?: number;
  /** A glowing gradient ring around the avatar (profiles, the chat header). */
  ring?: boolean;
  /** The person's chosen frame (ring colours and charm). Only shown together with `ring`; "none" turns the ring off. */
  frame?: string;
};

/** A round avatar: the profile photo when there is one, otherwise the initial on a colourful gradient. */
export function Avatar({ name, hue, size = 40, userId, version, ring, frame }: Props) {
  const theme = useTheme();
  const hasPhoto = !!userId && !!version && version > 0;
  const face = (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <LinearGradient colors={hueGradient(hue, theme.dark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: size, height: size }} />
      <Txt style={{ color: "#fff", fontFamily: font.heavy, fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Txt>
      {hasPhoto ? (
        // The version in the address makes a newly chosen photo appear at once; the old one stays cached.
        <Image
          source={{ uri: `${apiBaseUrl()}/api/v1/media/avatar/${userId}?v=${version}` }}
          style={{ position: "absolute", width: size, height: size }}
          contentFit="cover"
          transition={160}
          cachePolicy="disk"
          accessible={false}
        />
      ) : null}
    </View>
  );

  const look = ring ? frameLook(frame) : null;
  if (!look) return <View accessibilityLabel={`${name}'s avatar`}>{face}</View>;
  const pad = Math.max(2, Math.round(size * 0.05));
  return (
    <View accessibilityLabel={`${name}'s avatar`} style={{ borderRadius: size, shadowColor: look.colors[1], shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
      <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: pad, borderRadius: size }}>
        <View style={{ padding: pad, borderRadius: size, backgroundColor: theme.bg }}>{face}</View>
      </LinearGradient>
      {look.charm ? (
        <Txt accessible={false} style={{ position: "absolute", right: -size * 0.06, bottom: -size * 0.06, fontSize: Math.max(12, size * 0.3), lineHeight: Math.max(14, size * 0.36) }}>{look.charm}</Txt>
      ) : null}
    </View>
  );
}
