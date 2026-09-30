import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import type { Achievement } from "@/api/types";
import { TIER_LOOK, achievementIcon, progressShare } from "@/lib/achievements";
import { font, radius, space, useTheme } from "@/theme";
import { Txt } from "./ui";

/** A showcase banner: the colourful strip shown under someone's name. */
export function AchievementBanner({ achievement }: { achievement: Achievement }) {
  const look = TIER_LOOK[achievement.tier];
  return (
    <LinearGradient
      colors={look.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm }}
      accessible
      accessibilityLabel={`${look.label} achievement: ${achievement.name}`}
    >
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={achievementIcon(achievement.icon)} size={17} color={look.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1} style={{ color: look.text, fontFamily: font.heavy }}>{achievement.name}</Txt>
        <Txt variant="caption" style={{ color: look.text, opacity: 0.8 }}>{look.label.toUpperCase()}</Txt>
      </View>
    </LinearGradient>
  );
}

/** One achievement in the full list: unlocked ones in colour, locked ones grey with a progress bar. */
export function AchievementTile({ achievement, showcased, onToggleShowcase }: { achievement: Achievement; showcased?: boolean; onToggleShowcase?: () => void }) {
  const theme = useTheme();
  const look = TIER_LOOK[achievement.tier];
  const share = progressShare(achievement);
  return (
    <View style={{ backgroundColor: theme.surface, borderRadius: radius.md, padding: space.md, gap: space.xs, borderWidth: 1, borderColor: theme.hairline, opacity: achievement.unlocked ? 1 : 0.75 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {achievement.unlocked ? (
          <LinearGradient colors={look.colors} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={achievementIcon(achievement.icon)} size={18} color={look.text} />
          </LinearGradient>
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.elevated }}>
            <Ionicons name={achievementIcon(achievement.icon)} size={18} color={theme.subtle} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="small" style={{ fontFamily: font.bold }} numberOfLines={1}>{achievement.name}</Txt>
          <Txt variant="caption" tone="muted" numberOfLines={2}>{achievement.desc}</Txt>
        </View>
        {achievement.unlocked && onToggleShowcase ? (
          <Pressable
            onPress={onToggleShowcase}
            accessibilityRole="button"
            accessibilityState={{ selected: !!showcased }}
            accessibilityLabel={showcased ? `Stop showing ${achievement.name} on your profile` : `Show ${achievement.name} on your profile`}
            hitSlop={10}
          >
            <Ionicons name={showcased ? "star" : "star-outline"} size={20} color={showcased ? theme.accent : theme.subtle} />
          </Pressable>
        ) : null}
      </View>
      {achievement.unlocked ? (
        <Txt variant="caption" tone="subtle">{look.label}</Txt>
      ) : (
        <View style={{ gap: 2 }} accessible accessibilityLabel={`${achievement.progress} of ${achievement.target}`}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.elevated, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(share * 100)}%`, height: 6, backgroundColor: theme.accent }} />
          </View>
          <Txt variant="caption" tone="subtle">{achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}</Txt>
        </View>
      )}
    </View>
  );
}
