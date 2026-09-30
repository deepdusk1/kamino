import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api/endpoints";
import { CATEGORIES, type Visibility } from "@/api/types";
import { Button, Chip, Field, Screen, Txt } from "@/components/ui";
import { useAction } from "@/lib/errors";
import { space } from "@/theme";

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone can find and join it." },
  { value: "unlisted", label: "Unlisted", hint: "Only people with the link can find it." },
  { value: "private", label: "Private", hint: "People ask to join and you approve them." },
];

export default function NewCommunity() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [ageGate, setAgeGate] = useState(18);

  const [create, creating] = useAction(async () => {
    if (name.trim().length < 3) throw new Error("Give your community a name (at least 3 characters).");
    if (description.trim().length < 10) throw new Error("Add a short description so people know what it's about.");
    const created = await api.createCommunity({ name: name.trim(), tagline: tagline.trim(), description: description.trim(), category, visibility, ageGate, rules: rules.trim() });
    await queryClient.invalidateQueries();
    router.replace(`/community/${created.id}`);
  });

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
      <Field label="Tagline" value={tagline} onChangeText={setTagline} maxLength={100} placeholder="One line that sells it" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Category</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Who can join</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {VISIBILITY.map((v) => <Chip key={v.value} label={v.label} selected={visibility === v.value} onPress={() => setVisibility(v.value)} />)}
        </View>
        <Txt variant="small" tone="muted">{VISIBILITY.find((v) => v.value === visibility)?.hint}</Txt>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Minimum age</Txt>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[18].map((age) => <Chip key={age} label={`${age}+`} selected={ageGate === age} onPress={() => setAgeGate(age)} />)}
        </View>
        <Txt variant="small" tone="muted">Kamino is for ages 13 and up. You can raise the minimum for your community.</Txt>
      </View>
      <Field label="Rules (optional)" value={rules} onChangeText={setRules} multiline maxLength={2000} placeholder="Be kind. No spoilers without a warning." />
      <Button label="Create community" onPress={() => void create()} busy={creating} />
    </Screen>
  );
}
