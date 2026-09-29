import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { api } from "@/api/endpoints";
import { REPORT_REASONS } from "@/api/types";
import { useAction } from "@/lib/errors";
import { space, useTheme } from "@/theme";
import { Button, Chip, Field, Sheet, Txt } from "./ui";

export type ReportTarget = { targetType: "post" | "comment" | "message" | "user"; targetId: string; communityId?: string; label: string };

/** Report content or a person. Required by the app stores for anything users can post. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const theme = useTheme();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");

  const [send, busy] = useAction(async () => {
    if (!target) return;
    await api.report({ communityId: target.communityId, targetType: target.targetType, targetId: target.targetId, reason, details: details.trim() || undefined });
    setDetails("");
    onClose();
    Alert.alert("Report sent", "Thank you. A community leader will review it.");
  });

  return (
    <Sheet visible={!!target} title={`Report ${target?.label ?? ""}`} onClose={onClose}>
      <Txt tone="muted">Why are you reporting this? Reports go to the community’s leaders, not to the person.</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Field label="Anything else we should know? (optional)" value={details} onChangeText={setDetails} multiline maxLength={500} />
      <Button label="Send report" onPress={() => void send()} busy={busy} />
      <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: "center", padding: space.sm }}>
        <Txt tone="muted" style={{ color: theme.muted }}>Cancel</Txt>
      </Pressable>
    </Sheet>
  );
}
