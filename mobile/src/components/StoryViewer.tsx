import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { radius } from "@/theme";
import { Txt } from "./ui";

type Source = { uri: string; headers?: Record<string, string> };

/**
 * A story with several scenes: one picture at a time, progress bars on top, tap the right side for the next scene and
 * the left side to go back. Nothing advances on its own, so people read at their own pace.
 */
export function StoryViewer({ scenes, captions = [] }: { scenes: Source[]; captions?: string[] }) {
  const [index, setIndex] = useState(0);
  const last = scenes.length - 1;
  const go = (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta)));
  const caption = captions[index]?.trim();

  return (
    <View
      style={{ height: 360, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" }}
      accessibilityLabel={`Story, scene ${index + 1} of ${scenes.length}`}
    >
      <Image key={index} source={scenes[index]} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" accessibilityLabel={caption || `Scene ${index + 1}`} />
      {scenes.length > 1 ? (
        <>
          <View pointerEvents="none" style={{ position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", gap: 4 }}>
            {scenes.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= index ? "#ffffff" : "rgba(255,255,255,0.35)" }} />
            ))}
          </View>
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row" }}>
            <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Previous scene" disabled={index === 0} />
            <Pressable style={{ flex: 1 }} onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Next scene" disabled={index === last} />
          </View>
        </>
      ) : null}
      {caption ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 10 }}>
          <Txt style={{ color: "#fff" }}>{caption}</Txt>
        </View>
      ) : null}
    </View>
  );
}
