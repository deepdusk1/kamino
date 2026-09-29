import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { assetUrl } from "@/api/client";
import type { Community } from "@/api/types";
import { compactCount } from "@/lib/format";
import { glowShadow, hueColor, hueGradient, radius, space, useTheme } from "@/theme";
import { Appear, PressableScale, Txt } from "./ui";

/**
 * A community tile: its cover photo (or a bright gradient in the community's colour), a glossy
 * sheen, and the name on a dark fade so it is always readable. `compact` is the carousel size.
 */
export function CommunityCard({ community, compact, index }: { community: Community; compact?: boolean; index?: number }) {
  const theme = useTheme();
  const height = compact ? 132 : 164;
  const tile = (
    <PressableScale
      onPress={() => router.push(`/community/${community.id}`)}
      accessibilityLabel={`${community.name}, ${community.memberCount} members`}
      scaleTo={0.97}
      style={[{ width: compact ? 176 : undefined, height, borderRadius: radius.lg }, glowShadow(hueColor(community.hue, theme.dark))]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, overflow: "hidden" }]}>
        <LinearGradient colors={hueGradient(community.hue, theme.dark)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {community.cover ? <Image source={{ uri: assetUrl(community.cover) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} /> : null}
        <LinearGradient colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", "rgba(12,6,32,0.82)"]} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      {!compact && community.visibility !== "public" ? (
        <View style={styles.badge}>
          <Ionicons name="lock-closed" size={11} color="#fff" />
          <Txt variant="caption" style={{ color: "#fff" }}>{community.visibility}</Txt>
        </View>
      ) : null}
      <View style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: 2 }}>
        <Txt variant="heading" numberOfLines={1} style={{ color: "#fff" }}>{community.name}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="people" size={12} color="#ffffffd9" />
          <Txt variant="caption" numberOfLines={1} style={{ color: "#ffffffd9" }}>
            {compactCount(community.memberCount)} · {community.category}
          </Txt>
        </View>
      </View>
    </PressableScale>
  );
  return index === undefined ? tile : <Appear index={index}>{tile}</Appear>;
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(12,6,32,0.45)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
});
