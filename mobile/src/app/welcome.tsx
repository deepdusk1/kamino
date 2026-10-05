import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudEdge, GradientWord, ShineDashes, Sparkle, Swoosh } from "@/components/home/Decor";
import { GradientButton, KaminoWordmark } from "@/components/k";
import { PressableScale, Txt } from "@/components/ui";
import { heroArt, interestArt, welcomeArt } from "@/lib/brandArt";
import { font, shadow, useTheme, type Tone } from "@/theme";

/**
 * The first screen signed-out people see (mockup 01-welcome): a dreamy sky with three tilted picture cards,
 * "Find Your People", a few interest chips, "Get Started" (create an account) and "I already have an account"
 * (sign in). Swipe sideways for two more slides. Kamino needs an account, so "Skip" goes to the sign-in screen.
 */

type Chip = { label: string; emoji: string; tone: Tone };
type Slide = {
  key: string;
  /** Headline: plain words, then the gradient word. */
  lead: string;
  highlight: string;
  text: string;
  chips: Chip[];
  /** Left, middle and right card pictures. */
  cards: [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType];
};

const SLIDES: Slide[] = [
  {
    key: "people",
    lead: "Find Your ",
    highlight: "People",
    text: "Join communities, share your passions, and make new friends.",
    chips: [
      { label: "Gaming", emoji: "🎮", tone: "violet" },
      { label: "Art", emoji: "🎨", tone: "orange" },
      { label: "Music", emoji: "🎵", tone: "pink" },
      { label: "Anime", emoji: "🐾", tone: "orange" },
      { label: "K-Pop", emoji: "📘", tone: "blue" },
      { label: "Writing", emoji: "✍️", tone: "violet" },
      { label: "Fitness", emoji: "🏋️", tone: "green" },
      { label: "Pets", emoji: "🐱", tone: "pink" },
    ],
    cards: [welcomeArt.cards[1]!, welcomeArt.cards[0]!, welcomeArt.cards[2]!],
  },
  {
    key: "story",
    lead: "Live the ",
    highlight: "Story",
    text: "Jump into AI role-play stories with your friends and communities.",
    chips: [
      { label: "Stories", emoji: "📖", tone: "violet" },
      { label: "AI characters", emoji: "🤖", tone: "blue" },
      { label: "Role-play", emoji: "🎭", tone: "pink" },
      { label: "Worlds", emoji: "🗺️", tone: "orange" },
    ],
    cards: [interestArt.books, interestArt.writing, interestArt.manga],
  },
  {
    key: "achievements",
    lead: "Earn ",
    highlight: "Achievements",
    text: "Check in every day, keep your streak, and collect badges along the way.",
    chips: [
      { label: "Streaks", emoji: "🔥", tone: "orange" },
      { label: "Badges", emoji: "🏅", tone: "violet" },
      { label: "Levels", emoji: "⭐", tone: "blue" },
      { label: "Top Creator", emoji: "🏆", tone: "pink" },
    ],
    cards: [interestArt.fitness, heroArt["home-3"]!, interestArt.astrology],
  },
];

export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  // Where the white lower half begins. Measured on the mockup (388pt of an 813pt-tall screen); taller phones
  // give a little of the extra room to the sky and the rest to the space above the button.
  const usable = H - insets.top - insets.bottom;
  const edge = insets.top + Math.round(usable >= 813 ? 388 + (usable - 813) * 0.6 : 388 - (813 - usable) * 0.8);
  const k = Math.max(0.68, Math.min(1.1, (edge - insets.top) / 388)) * Math.min(1, W / 430);
  const lower = theme.dark ? theme.bg : "#FFFFFF";

  const goTo = (i: number) => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * W, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: lower }}>
      {/* The sky stays still while the slides move over it. */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: edge + 40 }}>
        <Image source={welcomeArt.sky} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessible={false} />
        {theme.dark ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14,11,31,0.35)" }]} /> : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / W);
          if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
        }}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((slide) => (
          <SlidePage key={slide.key} slide={slide} width={W} height={H} edge={edge} k={k} lower={lower} />
        ))}
      </ScrollView>

      {/* Logo and Skip (stay put). */}
      <View style={{ position: "absolute", top: insets.top + 16, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }} pointerEvents="box-none">
        <KaminoWordmark size={29} />
        <PressableScale
          onPress={() => router.push("/sign-in")}
          accessibilityLabel="Skip to sign in"
          hitSlop={8}
          scaleTo={0.92}
          style={[styles.skip, { backgroundColor: theme.dark ? "rgba(23,19,46,0.85)" : "rgba(255,255,255,0.92)" }, shadow.card]}
        >
          <Txt style={{ fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, color: theme.text }}>Skip</Txt>
          <Ionicons name="chevron-forward" size={14} color={theme.text} />
        </PressableScale>
      </View>

      {/* Buttons and page dots (stay put). */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 18, alignItems: "center" }} pointerEvents="box-none">
        <GradientButton
          label="Get Started"
          gradient="hero"
          size="lg"
          iconRight="arrow-forward"
          onPress={() => router.push("/sign-in?mode=up")}
          accessibilityLabel="Get started: create an account"
          style={{ width: Math.min(333, W - 64), height: 56, alignSelf: "center" }}
        />
        <PressableScale onPress={() => router.push("/sign-in?mode=in")} accessibilityLabel="I already have an account: sign in" scaleTo={0.95} style={{ minHeight: 44, justifyContent: "center", marginTop: 8, paddingHorizontal: 12 }}>
          <Txt style={{ fontFamily: font.semibold, fontSize: 15.5, lineHeight: 20, color: theme.accent }}>I already have an account</Txt>
        </PressableScale>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
          {SLIDES.map((s, i) => (
            <PressableScale key={s.key} onPress={() => goTo(i)} accessibilityLabel={`Show slide ${i + 1} of ${SLIDES.length}`} accessibilityState={{ selected: i === index }} haptics={false} style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === index ? theme.violet : theme.dark ? "#4A4470" : "#C9C6D6" }} />
            </PressableScale>
          ))}
        </View>
      </View>
    </View>
  );
}

/** One slide: the three tilted cards, the cloud edge, the headline, the line under it and the chips. */
function SlidePage({ slide, width: W, height: H, edge, k, lower }: { slide: Slide; width: number; height: number; edge: number; k: number; lower: string }) {
  const theme = useTheme();
  const [wordWidth, setWordWidth] = useState(0);
  const sx = W / 430;
  const headline = Math.min(42, (W - 64) / ((slide.lead.length + slide.highlight.length) * 0.56));

  // Card boxes measured on the mockup (pt), bottoms relative to the cloud edge.
  const cards = [
    { left: -16 * sx, w: 108 * k, h: 184 * k, bottom: 16, rot: "-9deg", src: slide.cards[0] },
    { left: 324 * sx, w: 128 * k, h: 198 * k, bottom: 30, rot: "6deg", src: slide.cards[2] },
    { left: W / 2 - 4 * sx - (102 * k), w: 204 * k, h: 248 * k, bottom: 20, rot: "6deg", src: slide.cards[1] },
  ];

  return (
    <View style={{ width: W, height: H }}>
      {cards.map((c, i) => (
        <View
          key={i}
          style={[
            styles.card,
            { left: c.left, top: edge - c.bottom - c.h, width: c.w, height: c.h, borderRadius: 22 * k, transform: [{ rotate: c.rot }], borderColor: theme.dark ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.95)" },
          ]}
        >
          <Image source={c.src} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        </View>
      ))}

      {/* Little hearts and sparkles floating over the sky. */}
      <Ionicons name="heart-outline" size={22} color="#FF8FC8" style={{ position: "absolute", left: 14 * sx, top: edge - 238 * k }} />
      <Ionicons name="heart-outline" size={20} color="#FF8FC8" style={{ position: "absolute", right: 14 * sx, top: edge - 92 * k }} />
      <Sparkle size={14} style={{ position: "absolute", left: 60 * sx, top: edge - 270 * k }} />

      {/* Cloud edge into the lower half, then a solid block so nothing shows through behind the text. */}
      <View style={{ position: "absolute", left: 0, top: edge - 78, width: W }} pointerEvents="none">
        <CloudEdge width={W} height={130} color={lower} />
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, top: edge + 50, bottom: 0, backgroundColor: lower }} />
      <Sparkle size={26} style={{ position: "absolute", right: 22 * sx, top: edge + 4 }} />

      <View style={{ position: "absolute", left: 0, right: 0, top: edge + 44, alignItems: "center", paddingHorizontal: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }} accessible accessibilityRole="header" accessibilityLabel={`${slide.lead}${slide.highlight}`}>
          <View style={{ position: "absolute", left: -32, top: 4 }}>
            <Sparkle size={14} style={{ marginLeft: 10 }} />
            <Sparkle size={20} />
          </View>
          <Txt style={{ fontFamily: font.heavy, fontSize: headline, lineHeight: Math.round(headline * 1.2), letterSpacing: -0.8, color: theme.ink }}>{slide.lead}</Txt>
          <View onLayout={(e) => setWordWidth(e.nativeEvent.layout.width)}>
            <GradientWord text={slide.highlight} size={headline} />
            {wordWidth ? <Swoosh width={wordWidth + 12} style={{ position: "absolute", left: 2, bottom: -9 }} /> : null}
            <View style={{ position: "absolute", right: -18, top: 0 }}>
              <ShineDashes size={18} />
            </View>
          </View>
        </View>
        <Txt style={{ marginTop: 16, textAlign: "center", fontFamily: font.regular, fontSize: 17, lineHeight: 22, color: theme.dark ? theme.muted : "#4A4766", maxWidth: 330 }}>{slide.text}</Txt>
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5, rowGap: 9, maxWidth: 410 }}>
          {slide.chips.map((chip) => (
            <View key={chip.label} accessible accessibilityLabel={chip.label} style={[styles.chip, { backgroundColor: theme.tints[chip.tone] }]}>
              <Txt style={{ fontSize: 17, lineHeight: 22 }}>{chip.emoji}</Txt>
              <Txt style={{ fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, color: theme.ink }}>{chip.label}</Txt>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="heart-outline" size={26} color="#FF8FC8" style={{ position: "absolute", right: 14 * sx, top: edge + 110 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skip: { flexDirection: "row", alignItems: "center", gap: 3, height: 34, paddingHorizontal: 14, borderRadius: 999, minWidth: 70, justifyContent: "center" },
  card: { position: "absolute", overflow: "hidden", borderWidth: 3, boxShadow: "0px 8px 24px rgba(60, 30, 120, 0.18)" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 39, paddingHorizontal: 11, borderRadius: 999 },
});
