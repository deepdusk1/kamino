import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@/api/endpoints";
import { BUBBLE_STYLES, MOOD_PRESETS, PROFILE_FRAME_IDS, type BubbleStyle, type Profile, type ProfileFrame } from "@/api/types";
import { Avatar, Button, Chip, ErrorState, Field, Loading, Screen, Txt } from "@/components/ui";
import { useAction } from "@/lib/errors";
import { BUBBLE_STYLE_LABELS } from "@/lib/cosmetics";
import { pickAvatar, pickPhoto } from "@/lib/media";
import { space, useTheme } from "@/theme";

const FRAME_LABELS: Record<ProfileFrame, string> = {
  none: "Plain", ring: "Ring", moon: "Moon", star: "Star", laurel: "Laurel", spark: "Sparkles", flame: "Flame", crown: "Crown", aurora: "Aurora",
};
const HUES = [0, 25, 50, 140, 175, 210, 250, 290, 330];

export default function EditProfile() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  if (me.isPending) return <Loading />;
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  return <Form profile={me.data.profile} onSaved={() => queryClient.invalidateQueries().then(() => router.back())} />;
}

function Form({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<unknown> }) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [status, setStatus] = useState(profile.status);
  const [mood, setMood] = useState(profile.mood);
  const [frame, setFrame] = useState<ProfileFrame>(profile.frame);
  const [bubbleHue, setBubbleHue] = useState(profile.bubbleHue);
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyle>(profile.bubbleStyle);

  // Photos are saved straight away (not with the Save button) so they never get lost.
  const [changePhoto, photoBusy] = useAction(async () => {
    const dataUrl = await pickAvatar("library");
    if (!dataUrl) return;
    await api.setAvatar(dataUrl);
    await queryClient.invalidateQueries();
  }, { errorTitle: "Couldn't set the photo" });
  const [removePhoto] = useAction(async () => {
    await api.removeAvatar();
    await queryClient.invalidateQueries();
  });

  const [changeCover, coverBusy] = useAction(async () => {
    const dataUrl = await pickPhoto("library", 1_400_000);
    if (!dataUrl) return;
    await api.setProfileCover(dataUrl);
    await queryClient.invalidateQueries();
  }, { errorTitle: "Couldn't set the cover" });
  const [removeCover] = useAction(async () => {
    await api.removeProfileCover();
    await queryClient.invalidateQueries();
  });

  const [save, saving] = useAction(async () => {
    if (displayName.trim().length < 2) throw new Error("Your name needs at least 2 characters.");
    await api.updateSettings({ displayName: displayName.trim(), bio, status, mood, frame, bubbleHue, bubbleStyle });
    await onSaved();
  });

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Avatar name={displayName || "?"} hue={profile.avatarHue} size={96} userId={profile.userId} version={profile.avatarVersion} ring frame={frame} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label={profile.avatarVersion ? "Change photo" : "Add a photo"} small variant="secondary" onPress={() => void changePhoto()} busy={photoBusy} />
          {profile.avatarVersion ? <Button label="Remove" small variant="ghost" onPress={() => void removePhoto()} busy={photoBusy} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label={profile.cover ? "Change wall cover" : "Add a wall cover"} small variant="secondary" onPress={() => void changeCover()} busy={coverBusy} />
          {profile.cover ? <Button label="Remove cover" small variant="ghost" onPress={() => void removeCover()} busy={coverBusy} /> : null}
        </View>
      </View>
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={280} hint={`${bio.length}/280`} />
      <Field label="Status" value={status} onChangeText={setStatus} maxLength={80} placeholder="What are you up to?" />
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Mood</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {MOOD_PRESETS.map((m) => <Chip key={m} label={m} selected={mood === m} onPress={() => setMood(mood === m ? "" : m)} />)}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Profile frame</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {PROFILE_FRAME_IDS.map((f) => <Chip key={f} label={FRAME_LABELS[f]} selected={frame === f} onPress={() => setFrame(f)} />)}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Chat bubble colour</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {HUES.map((h) => (
            <Pressable key={h} accessibilityRole="button" accessibilityLabel={`Bubble colour ${h}`} accessibilityState={{ selected: bubbleHue === h }} onPress={() => setBubbleHue(h)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `hsl(${h}, 70%, 62%)`, borderWidth: bubbleHue === h ? 3 : 0, borderColor: theme.fg }} />
          ))}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Txt variant="label" tone="subtle">Chat bubble style</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {BUBBLE_STYLES.map((b) => <Chip key={b} label={BUBBLE_STYLE_LABELS[b]} selected={bubbleStyle === b} onPress={() => setBubbleStyle(b)} />)}
        </View>
      </View>
      <Button label="Save" onPress={() => void save()} busy={saving} />
    </Screen>
  );
}
