import { useQuery, useQueryClient } from "@tanstack/react-query";
import {platform} from '@/api/platform-v9';
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api/endpoints";
import { CATEGORIES, type Visibility } from "@/api/types";
import { GradientButton, Pill } from "@/components/k";
import { Field, Screen, Txt } from "@/components/ui";
import { useAction } from "@/lib/errors";
import { font, space, useTheme } from "@/theme";

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone can find and join it." },
  { value: "unlisted", label: "Unlisted", hint: "Only people with the link can find it." },
  { value: "private", label: "Private", hint: "People ask to join and you approve them." },
];

export default function NewCommunity() {
  const taxonomy=useQuery({queryKey:['customTaxonomy'],queryFn:platform.taxonomy});
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [ageGate, setAgeGate] = useState(13);

  const [create, creating] = useAction(async () => {
    if (name.trim().length < 3) throw new Error("Give your community a name (at least 3 characters).");
    if (description.trim().length < 10) throw new Error("Add a short description so people know what it's about.");
    const created = await api.createCommunity({ name: name.trim(), tagline: tagline.trim(), description: description.trim(), category, visibility, ageGate, rules: rules.trim() });
    await queryClient.invalidateQueries();
    router.replace(`/community/${created.id}`);
  });

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Txt accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: theme.ink }}>Start a community 🌱</Txt>
        <Txt variant="small" tone="muted">A home for your people. You can change the look, rules and topics any time.</Txt>
      </View>
      <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
      <Field label="Tagline" value={tagline} onChangeText={setTagline} maxLength={100} placeholder="One line that sells it" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Category</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {[...CATEGORIES,...(taxonomy.data??[]).map(t=>String(t.label))].map((c) => <Pill key={c} label={c} size="md" tone={category === c ? "violet" : "neutral"} variant={category === c ? "solid" : "tint"} onPress={() => setCategory(c)} accessibilityLabel={`${c}${category === c ? ", chosen" : ""}`} />)}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Who can join</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {VISIBILITY.map((v) => <Pill key={v.value} label={v.label} size="md" tone={visibility === v.value ? "violet" : "neutral"} variant={visibility === v.value ? "solid" : "tint"} onPress={() => setVisibility(v.value)} accessibilityLabel={`${v.label}${visibility === v.value ? ", chosen" : ""}`} />)}
        </View>
        <Txt variant="small" tone="muted">{VISIBILITY.find((v) => v.value === visibility)?.hint}</Txt>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Minimum age</Txt>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[13, 16, 18].map((age) => <Pill key={age} label={`${age}+`} size="md" tone={ageGate === age ? "violet" : "neutral"} variant={ageGate === age ? "solid" : "tint"} onPress={() => setAgeGate(age)} accessibilityLabel={`Minimum age ${age}${ageGate === age ? ", chosen" : ""}`} />)}
        </View>
        <Txt variant="small" tone="muted">Kamino is for ages 13 and up. You can raise the minimum for your community.</Txt>
      </View>
      <Field label="Rules (optional)" value={rules} onChangeText={setRules} multiline maxLength={2000} placeholder="Be kind. No spoilers without a warning." />
      <GradientButton label="Create community" gradient="hero" iconRight="arrow-forward" size="lg" full onPress={() => void create()} busy={creating} />
    </Screen>
  );
}
