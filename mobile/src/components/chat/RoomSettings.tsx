import { useState } from "react";
import { Alert, Switch, View } from "react-native";
import { api } from "@/api/endpoints";
import type { RoomPage } from "@/api/models";
import { Avatar, Button, Card, Chip, Field, Sheet, Txt } from "@/components/ui";
import { showError, useAction } from "@/lib/errors";
import { space, useTheme } from "@/theme";

type Props = { visible: boolean; onClose: () => void; page: RoomPage; myId?: string; onChanged: () => void };

/** Pin / mute, who is in the room, and (for hosts) invites and co-hosts. */
export function RoomSettings({ visible, onClose, page, myId, onChanged }: Props) {
  const { room, participants } = page;
  const [handle, setHandle] = useState("");
  const isHost = participants.some((p) => p.userId === myId && p.isHost);
  const isCohost = participants.some((p) => p.userId === myId && p.isCohost);
  const canInvite = room.kind !== "dm" && (isHost || isCohost || room.inviteRule === "members");

  const setPref = async (prefs: { pinned?: boolean; muted?: boolean }) => {
    try {
      await api.roomPreference(room.id, prefs);
      onChanged();
    } catch (error) {
      showError(error);
    }
  };

  const [invite, inviting] = useAction(async () => {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) throw new Error("Type the person's @handle.");
    await api.inviteToRoom(room.id, clean);
    setHandle("");
    onChanged();
    Alert.alert("Invited", `@${clean} can now join this room.`);
  });

  const guarded = (action: () => Promise<unknown>) => async () => {
    try {
      await action();
      onChanged();
    } catch (error) {
      showError(error);
    }
  };

  const confirmTransfer = (userId: string, name: string) =>
    Alert.alert(`Make ${name} the host?`, "You will no longer be the host of this room.", [
      { text: "Cancel", style: "cancel" },
      { text: "Transfer", style: "destructive", onPress: () => void guarded(() => api.transferHost(room.id, userId))() },
    ]);

  return (
    <Sheet visible={visible} title={room.kind === "dm" ? "Conversation" : room.name} onClose={onClose}>
      <Card>
        <Row label="Pin to the top of my chats" value={room.pinned} onChange={(pinned) => void setPref({ pinned })} />
        <Row label="Mute notifications" value={room.muted} onChange={(muted) => void setPref({ muted })} />
      </Card>

      {canInvite ? (
        <Card>
          <Txt variant="heading">Invite someone</Txt>
          <Field value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} placeholder="@handle" />
          <Button label="Send invite" small onPress={() => void invite()} busy={inviting} />
          {isHost && room.kind !== "dm" ? (
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", paddingTop: space.sm }}>
              <Txt variant="small" tone="muted">Who can invite:</Txt>
              <Chip label="Hosts" selected={room.inviteRule === "hosts"} onPress={() => void guarded(() => api.setInviteRule(room.id, "hosts"))()} />
              <Chip label="Everyone" selected={room.inviteRule === "members"} onPress={() => void guarded(() => api.setInviteRule(room.id, "members"))()} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {room.kind !== "dm" && participants.length ? (
        <Card>
          <Txt variant="heading">In this room · {participants.length}</Txt>
          {participants.map((p) => (
            <View key={p.userId} style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 4 }}>
              <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 37) % 360} size={34} />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1}>{p.name}</Txt>
                <Txt variant="caption" tone="subtle">@{p.handle}{p.isHost ? " · host" : p.isCohost ? " · co-host" : ""}</Txt>
              </View>
              {isHost && !p.isHost ? (
                <View style={{ flexDirection: "row", gap: space.xs }}>
                  <Chip label={p.isCohost ? "Remove co-host" : "Co-host"} onPress={() => void guarded(() => api.toggleCohost(room.id, p.userId))()} />
                  <Chip label="Make host" tone="danger" onPress={() => confirmTransfer(p.userId, p.name)} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
    </Sheet>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.accent, false: theme.border }} thumbColor="#ffffff" ios_backgroundColor={theme.border} />
    </View>
  );
}
