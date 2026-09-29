import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { api } from "@/api/endpoints";
import type { HallEvent } from "@/api/types";
import { ChallengePanel } from "@/components/ChallengePanel";
import { Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Sheet, Txt } from "@/components/ui";
import { showError, useAction } from "@/lib/errors";
import { formatDateTime, parseLocalDateTime } from "@/lib/format";
import { space } from "@/theme";
import { withCommunityTheme } from "@/components/CommunityTheme";

/** Events and challenges, with one-tap "I'm going". Leaders can add new ones. */
function Events() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const events = useQuery({ queryKey: ["events", slug], queryFn: () => api.events(slug!), enabled: !!slug });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"event" | "challenge">("event");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  const isLeader = !!events.data?.member && ["leader", "agent"].includes(events.data.member.role);

  const toggleGoing = async (event: HallEvent) => {
    try {
      await api.rsvp(slug!, event.id);
      await queryClient.invalidateQueries({ queryKey: ["events", slug] });
    } catch (error) {
      showError(error);
    }
  };

  const [create, creating] = useAction(async () => {
    const startsAt = parseLocalDateTime(starts);
    if (!startsAt) throw new Error("Write the start like 2026-10-31 19:30.");
    const endsAt = ends.trim() ? parseLocalDateTime(ends) : null;
    if (ends.trim() && !endsAt) throw new Error("Write the end like 2026-10-31 21:00, or leave it empty.");
    await api.createEvent({ slug: slug!, title: title.trim(), body: body.trim(), kind, startsAt, endsAt: endsAt ?? undefined });
    setTitle(""); setBody(""); setStarts(""); setEnds("");
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["events", slug] });
    Alert.alert("Event added");
  });

  if (events.isPending) return <Loading />;
  if (events.isError || !events.data) return <ErrorState error={events.error} onRetry={() => void events.refetch()} />;

  return (
    <>
      <FlatList
        data={events.data.events}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        refreshing={events.isRefetching}
        onRefresh={() => void events.refetch()}
        ListHeaderComponent={isLeader ? <Button label="Add event or challenge" small onPress={() => setOpen(true)} style={{ alignSelf: "flex-start", marginBottom: space.sm }} /> : null}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Chip label={item.kind === "challenge" ? "Challenge" : "Event"} />
              <Txt variant="caption" tone="muted">{formatDateTime(item.startsAt)}{item.endsAt ? ` – ${formatDateTime(item.endsAt)}` : ""}</Txt>
            </View>
            <Txt variant="heading">{item.title}</Txt>
            {item.body ? <Txt tone="muted">{item.body}</Txt> : null}
            {item.kind === "challenge" ? <ChallengePanel slug={slug!} event={item} isMember={events.data.member?.status === "active"} isLeader={isLeader} /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.xs }}>
              <Txt variant="small" tone="muted">{item.rsvpCount} going</Txt>
              {events.data.member?.status === "active" ? (
                <Button label={item.going ? "Going ✓" : "I'm going"} small variant={item.going ? "secondary" : "primary"} onPress={() => void toggleGoing(item)} />
              ) : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="calendar-outline" title="No events yet" body={isLeader ? "Add the first event for your community." : "Leaders can add events and challenges here."} />}
      />

      <Sheet visible={open} title="New event" onClose={() => setOpen(false)}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label="Event" selected={kind === "event"} onPress={() => setKind("event")} />
          <Chip label="Challenge" selected={kind === "challenge"} onPress={() => setKind("challenge")} />
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <Field label="Details" value={body} onChangeText={setBody} multiline maxLength={2000} />
        <Field label="Starts (your local time)" value={starts} onChangeText={setStarts} placeholder="2026-10-31 19:30" autoCapitalize="none" />
        <Field label="Ends (optional)" value={ends} onChangeText={setEnds} placeholder="2026-10-31 21:00" autoCapitalize="none" />
        <Button label="Add" onPress={() => void create()} busy={creating} />
      </Sheet>
    </>
  );
}

export default withCommunityTheme(Events);
