import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Linking, Share, Switch, View } from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { apiBaseUrl, SUPPORT_EMAIL } from "@/api/config";
import { api } from "@/api/endpoints";
import { referrals } from "@/api/referrals";
import type { DmPrivacy, NotifyPrefs, Profile } from "@/api/types";
import { useSession } from "@/auth/session";
import { confirmAction, notify } from "@/components/community/platform";
import { PersonAvatar } from "@/components/k";
import { hourLabel } from "@/components/profile/helpers";
import { Button, ErrorState, Field, Loading, PressableScale, Screen, Sheet, Txt } from "@/components/ui";
import { errorMessage, useAction } from "@/lib/errors";
import { font, radius, shadow, useTheme, type Tone } from "@/theme";

type Toggle = keyof Pick<Profile, "notifyLikes" | "notifyComments" | "notifyFollows" | "notifyChat" | "notifyWall">;

/** The older, finer switches (still used by the server for each kind of activity). */
const FINE_TUNE: { key: Toggle; label: string }[] = [
  { key: "notifyLikes", label: "Likes on my posts" },
  { key: "notifyComments", label: "Comments and replies" },
  { key: "notifyFollows", label: "New followers" },
  { key: "notifyChat", label: "Chat messages" },
  { key: "notifyWall", label: "Wall posts" },
];

/** Phone alerts by notification category (the in-app list always fills). */
const CATEGORIES: { key: keyof NotifyPrefs; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone }[] = [
  { key: "social", label: "Social", hint: "Likes, comments, mentions, follows", icon: "heart", tone: "pink" },
  { key: "community", label: "Community", hint: "Invites, announcements, achievements", icon: "people", tone: "blue" },
  { key: "events", label: "Events & live", hint: "Event reminders, live rooms, calls", icon: "calendar", tone: "orange" },
  { key: "messages", label: "Messages", hint: "New chat messages", icon: "chatbubble-ellipses", tone: "violet" },
];

const DM_OPTIONS: { value: DmPrivacy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "members", label: "People I share a community with" },
  { value: "none", label: "No one" },
];

/** The phone's time zone, e.g. "America/Vancouver" (quiet hours use it). */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export default function Settings() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { signOut } = useSession();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const sentZone = useRef(false);

  const save = async (patch: Parameters<typeof api.updateSettings>[0]) => {
    // Show the change straight away; the server copy comes back with the refresh.
    queryClient.setQueryData<typeof me.data>(["me"], (prev) => (prev ? { ...prev, profile: { ...prev.profile, ...(patch as Partial<Profile>), notifyPrefs: { ...prev.profile.notifyPrefs, ...(patch.notifyPrefs ?? {}) } } } : prev));
    try {
      await api.updateSettings(patch);
    } catch (error) {
      notify("Couldn't save that", errorMessage(error));
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    void queryClient.invalidateQueries({ queryKey: ["profileOverview"] });
  };

  // Tell the server the phone's time zone once, so quiet hours follow local time.
  const profile = me.data?.profile;
  useEffect(() => {
    if (!profile || sentZone.current) return;
    sentZone.current = true;
    const zone = deviceTimeZone();
    if (zone && zone !== profile.timezone) api.updateSettings({ timezone: zone }).catch(() => undefined);
  }, [profile]);

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
    if (confirmText.trim() !== "DELETE") throw new Error("Type DELETE (in capitals) to confirm.");
    await api.deleteAccount();
    setDeleteOpen(false);
    await signOut();
  });

  const unblock = async (userId: string) => {
    try {
      await api.block(userId); // the same call toggles: blocked → unblocked
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      notify("Couldn't unblock", errorMessage(error));
    }
  };

  if (me.isPending) return <Loading />;
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  const p = me.data.profile;
  // Older accounts may miss some keys; anything missing counts as on (digest as off).
  const prefs: NotifyPrefs = { ...{ social: true, community: true, events: true, messages: true, digest: false }, ...(p.notifyPrefs as Partial<NotifyPrefs>) };
  const quietOn = p.quietStart !== null && p.quietEnd !== null;

  return (
    <Screen>
      <Section title="Privacy dashboard" icon="shield-checkmark" tone="violet"><LinkRow icon="people" label="Privacy, muted people and identity" onPress={() => router.push('/privacy-dashboard' as never)}/><LinkRow icon="lock-closed" label="Security and signed-in devices" onPress={() => router.push('/security' as never)}/><LinkRow icon="compass" label="Welcome tour" onPress={() => router.push('/tutorial' as never)}/></Section>
      <Section title="More tools" icon="grid" tone="blue"><LinkRow icon="sparkles" label="Discovery, creator studio, marketplace and support" onPress={() => router.push('/tools' as never)}/></Section>
      <Section title="Safety Center" icon="shield-checkmark" tone="green"><LinkRow icon="shield-checkmark" label="Community standing, reports and help" onPress={() => router.push('/safety' as never)}/></Section>
      <Section title="Privacy" icon="lock-closed" tone="violet">
        <SwitchRow
          label="Private account"
          hint="Only people you approve can follow you and see your posts, badges and communities."
          value={p.privateAccount}
          onChange={(privateAccount) => void save({ privateAccount })}
        />
        <SwitchRow label="Show when I'm online" hint="A green dot on your picture while you use Kamino." value={p.showOnline} onChange={(showOnline) => void save({ showOnline })} />
        <SwitchRow label="Read receipts" hint="Let people see when you've read their messages. Turning it off hides theirs from you too." value={p.showReadReceipts} onChange={(showReadReceipts) => void save({ showReadReceipts })} />
        <SwitchRow label="Hide the communities I've joined" value={p.hideJoined} onChange={(hideJoined) => void save({ hideJoined })} />
        <Txt style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 19, color: theme.ink, marginTop: 4 }}>Who can message me</Txt>
        <View style={{ gap: 6 }}>
          {DM_OPTIONS.map((o) => (
            <RadioRow key={o.value} label={o.label} selected={p.dmPrivacy === o.value} onPress={() => void save({ dmPrivacy: o.value })} />
          ))}
        </View>
      </Section>

      <Section title="Notifications" icon="notifications" tone="orange" hint="Control phone alerts for activity, event reminders and community updates. Your notification list still keeps the updates you can access.">
        {CATEGORIES.map((c) => (
          <SwitchRow key={c.key} label={c.label} hint={c.hint} icon={c.icon} tone={c.tone} value={prefs[c.key]} onChange={(value) => void save({ notifyPrefs: { [c.key]: value } })} />
        ))}
        <SwitchRow label="Weekly digest" hint="A short summary of what you missed." icon="mail" tone="green" value={prefs.digest} onChange={(digest) => void save({ notifyPrefs: { digest } })} />

        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />
        <SwitchRow
          label="Quiet hours"
          hint="No phone alerts during these hours (your local time)."
          icon="moon"
          tone="violet"
          value={quietOn}
          onChange={(on) => void save(on ? { quietStart: 22, quietEnd: 7 } : { quietStart: null, quietEnd: null })}
        />
        {quietOn ? (
          <View style={{ gap: 8, paddingLeft: 46 }}>
            <HourStepper label="From" hour={p.quietStart!} onChange={(quietStart) => void save({ quietStart })} />
            <HourStepper label="Until" hour={p.quietEnd!} onChange={(quietEnd) => void save({ quietEnd })} />
            <Txt style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: theme.subtle }}>Time zone: {p.timezone || deviceTimeZone() || "UTC"}</Txt>
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />
        <Txt style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 19, color: theme.ink }}>Fine-tune</Txt>
        {FINE_TUNE.map((n) => <SwitchRow key={n.key} label={n.label} value={p[n.key]} onChange={(value) => void save({ [n.key]: value })} />)}
      </Section>

      {me.data.blocked.length ? (
        <Section title="Blocked people" icon="ban" tone="red">
          {me.data.blocked.map((b) => (
            <View key={b.blocked_id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PersonAvatar person={{ name: b.display_name, hue: 260 }} size={34} />
              <Txt style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, lineHeight: 19, color: theme.ink }}>
                {b.display_name} <Txt style={{ fontFamily: font.regular, fontSize: 13, color: theme.subtle }}>@{b.handle}</Txt>
              </Txt>
              <Button label="Unblock" small variant="secondary" onPress={() => void unblock(b.blocked_id)} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Your data" icon="cloud-download" tone="blue">
        <LinkRow icon="download-outline" label="Export everything I've posted" busy={exporting} onPress={() => void exportData()} />
        <LinkRow icon="push-outline" label="Import an exported file" busy={importing} onPress={() => void importData()} />
        <Txt style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: theme.muted }}>
          Your posts and drafts come back as private drafts in the communities you are in. Importing the same file twice is safe.
        </Txt>
      </Section>

      <InviteFriendsSection />

      <Section title="Help & legal" icon="information-circle" tone="green">
        <LinkRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => void Linking.openURL(`${apiBaseUrl()}/privacy`)} />
        <LinkRow icon="document-text-outline" label="Terms of use" onPress={() => void Linking.openURL(`${apiBaseUrl()}/terms`)} />
        <LinkRow icon="mail-outline" label="Contact support" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </Section>

      <View style={{ gap: 8 }}>
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => {
            void confirmAction("Sign out?", "You can sign back in any time.", "Sign out").then(async (ok) => {
              if (ok) await signOut();
            });
          }}
        />
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

/** A white card with a tinted icon circle and a title. */
function InviteFriendsSection() {
  const theme = useTheme();
  const referral = useQuery({ queryKey: ["myReferral"], queryFn: () => referrals.mine(), staleTime: 30_000 });
  if (!referral.data) return null;
  return (
    <Section title="Invite friends" icon="person-add" tone="orange">
      <Txt style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: theme.muted }}>
        Share your link. When a friend joins and claims it, you earn {referral.data.repPerInvite} reputation and they
        start with {referral.data.repForFriend}. Reputation is earned, never bought.
      </Txt>
      <Txt style={{ fontFamily: font.bold, fontSize: 13, color: theme.text }}>
        {referral.data.invited} joined through your link · {referral.data.repEarned} reputation earned
      </Txt>
      <LinkRow
        icon="share-social-outline"
        label={`Share your invite code: ${referral.data.code}`}
        onPress={() =>
          void Share.share({
            message: `Join me on Kamino — ${apiBaseUrl()}${referral.data!.path}`,
          })
        }
      />
    </Section>
  );
}

function Section({ title, icon, tone, hint, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, shadow.card]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.tints[tone], alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={17} color={theme.toneText[tone]} />
        </View>
        <Txt accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 17, lineHeight: 22, color: theme.ink }}>{title}</Txt>
      </View>
      {hint ? <Txt style={{ fontFamily: font.regular, fontSize: 12.5, lineHeight: 17, color: theme.muted, marginTop: -4 }}>{hint}</Txt> : null}
      {children}
    </View>
  );
}

function SwitchRow({ label, hint, value, onChange, icon, tone = "violet" }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; icon?: keyof typeof Ionicons.glyphMap; tone?: Tone }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.tints[tone], alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={theme.toneText[tone]} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 19, color: theme.ink }}>{label}</Txt>
        {hint ? <Txt style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: theme.muted }}>{hint}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.violet, false: theme.border }} thumbColor="#ffffff" ios_backgroundColor={theme.border} />
    </View>
  );
}

function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} scaleTo={0.98} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.tile, borderWidth: 1, borderColor: selected ? theme.violet : theme.border, backgroundColor: selected ? theme.tints.violet : theme.surface }}>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? theme.violet : theme.subtle} />
      <Txt style={{ flex: 1, fontFamily: selected ? font.bold : font.semibold, fontSize: 13.5, lineHeight: 18, color: selected ? theme.toneText.violet : theme.ink }}>{label}</Txt>
    </PressableScale>
  );
}

function LinkRow({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.98} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <Ionicons name={icon} size={19} color={theme.violet} />
      <Txt style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, lineHeight: 19, color: theme.ink }}>{busy ? "Working…" : label}</Txt>
      <Ionicons name="chevron-forward" size={16} color={theme.subtle} />
    </PressableScale>
  );
}

/** "From  [-] 10 PM [+]" — picks an hour 0–23, wrapping around midnight. */
function HourStepper({ label, hour, onChange }: { label: string; hour: number; onChange: (h: number) => void }) {
  const theme = useTheme();
  const step = (d: number) => onChange((hour + d + 24) % 24);
  const btn = (icon: "remove" | "add", d: number, a11y: string) => (
    <PressableScale onPress={() => step(d)} accessibilityLabel={a11y} hitSlop={6} scaleTo={0.9} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.tints.violet, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={18} color={theme.toneText.violet} />
    </PressableScale>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Txt style={{ width: 48, fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, color: theme.muted }}>{label}</Txt>
      {btn("remove", -1, `${label}: one hour earlier`)}
      <Txt accessibilityLabel={`${label} ${hourLabel(hour)}`} style={{ minWidth: 64, textAlign: "center", fontFamily: font.heavy, fontSize: 15, lineHeight: 20, color: theme.ink }}>{hourLabel(hour)}</Txt>
      {btn("add", 1, `${label}: one hour later`)}
    </View>
  );
}
