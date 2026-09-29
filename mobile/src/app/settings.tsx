import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Linking, Share, Switch, View } from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { apiBaseUrl, SUPPORT_EMAIL } from "@/api/config";
import { api } from "@/api/endpoints";
import type { DmPrivacy, Profile } from "@/api/types";
import { useSession } from "@/auth/session";
import { Button, Card, Chip, ErrorState, Field, Loading, Screen, Sheet, Txt } from "@/components/ui";
import { showError, useAction } from "@/lib/errors";
import { space, useTheme } from "@/theme";

type Toggle = keyof Pick<Profile, "hideJoined" | "showOnline" | "notifyLikes" | "notifyComments" | "notifyFollows" | "notifyChat" | "notifyWall">;

const NOTIFICATIONS: { key: Toggle; label: string }[] = [
  { key: "notifyLikes", label: "Likes on my posts" },
  { key: "notifyComments", label: "Comments and replies" },
  { key: "notifyFollows", label: "New followers" },
  { key: "notifyChat", label: "Chat messages" },
  { key: "notifyWall", label: "Wall posts" },
];

const DM_OPTIONS: { value: DmPrivacy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "members", label: "People I share a community with" },
  { value: "none", label: "No one" },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const save = async (patch: Parameters<typeof api.updateSettings>[0]) => {
    try {
      await api.updateSettings(patch);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      showError(error);
    }
  };

  const [exportData, exporting] = useAction(async () => {
    const { json } = await api.exportData();
    await Share.share({ message: json, title: "My Kamino data" });
  });

  const [importData, importing] = useAction(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true });
    const file = picked.assets?.[0];
    if (picked.canceled || !file) return;
    if (file.size && file.size > 20 * 1024 * 1024) throw new Error("That file is too large to import.");
    const result = await api.importData(await readAsStringAsync(file.uri));
    await queryClient.invalidateQueries({ queryKey: ["drafts"] });
    Alert.alert(
      "Import finished",
      `${result.imported} draft${result.imported === 1 ? "" : "s"} added${result.skipped ? `, ${result.skipped} skipped` : ""}. Find them under Drafts when you write a post. Nothing was published.`,
    );
  }, { errorTitle: "Couldn't import that file" });

  const [deleteAccount, deleting] = useAction(async () => {
    if (confirmText.trim() !== "DELETE") throw new Error('Type DELETE (in capitals) to confirm.');
    await api.deleteAccount();
    setDeleteOpen(false);
    await signOut();
  });

  const unblock = async (userId: string) => {
    try {
      await api.block(userId); // the same call toggles: blocked → unblocked
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      showError(error);
    }
  };

  if (me.isPending) return <Loading />;
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  const p = me.data.profile;

  return (
    <Screen>
      <Card>
        <Txt variant="heading">Who can message me</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {DM_OPTIONS.map((o) => <Chip key={o.value} label={o.label} selected={p.dmPrivacy === o.value} onPress={() => void save({ dmPrivacy: o.value })} />)}
        </View>
        <SwitchRow label="Show when I was last online" value={p.showOnline} onChange={(showOnline) => void save({ showOnline })} />
        <SwitchRow label="Hide the communities I've joined" value={p.hideJoined} onChange={(hideJoined) => void save({ hideJoined })} />
      </Card>

      <Card>
        <Txt variant="heading">Notify me about</Txt>
        <Txt variant="small" tone="muted">Kamino only notifies you about real activity. There are no reminders or promotions.</Txt>
        {NOTIFICATIONS.map((n) => <SwitchRow key={n.key} label={n.label} value={p[n.key]} onChange={(value) => void save({ [n.key]: value })} />)}
      </Card>

      {me.data.blocked.length ? (
        <Card>
          <Txt variant="heading">Blocked people</Txt>
          {me.data.blocked.map((b) => (
            <View key={b.blocked_id} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Txt style={{ flex: 1 }}>{b.display_name} <Txt tone="subtle">@{b.handle}</Txt></Txt>
              <Button label="Unblock" small variant="secondary" onPress={() => void unblock(b.blocked_id)} />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Txt variant="heading">Your data</Txt>
        <Button label="Export everything I've posted" variant="secondary" onPress={() => void exportData()} busy={exporting} />
        <Button label="Import an exported file" variant="secondary" onPress={() => void importData()} busy={importing} />
        <Txt variant="caption" tone="muted">Your posts and drafts come back as private drafts in the communities you are in. Importing the same file twice is safe.</Txt>
        <Button label="Privacy policy" variant="ghost" onPress={() => void Linking.openURL(`${apiBaseUrl()}/privacy`)} />
        <Button label="Terms of use" variant="ghost" onPress={() => void Linking.openURL(`${apiBaseUrl()}/terms`)} />
        <Button label="Contact support" variant="ghost" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </Card>

      <View style={{ gap: space.sm }}>
        <Button label="Sign out" variant="secondary" onPress={() => Alert.alert("Sign out?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Sign out", onPress: () => void signOut() }])} />
        <Button label="Delete my account" variant="danger" onPress={() => setDeleteOpen(true)} />
      </View>
      <Txt variant="caption" tone="subtle" style={{ textAlign: "center" }}>Kamino {Constants.expoConfig?.version ?? ""}</Txt>

      <Sheet visible={deleteOpen} title="Delete account" onClose={() => setDeleteOpen(false)}>
        <Txt tone="muted">This permanently deletes your profile, posts, messages and memberships. It can’t be undone.</Txt>
        <Field label="Type DELETE to confirm" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
        <Button label="Delete forever" variant="danger" onPress={() => void deleteAccount()} busy={deleting} disabled={confirmText.trim() !== "DELETE"} />
      </Sheet>
    </Screen>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.accent, false: theme.border }} thumbColor="#ffffff" ios_backgroundColor={theme.border} />
    </View>
  );
}
