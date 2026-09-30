import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api/endpoints";
import { CATEGORIES, type Community } from "@/api/types";
import { CommunityCard } from "@/components/CommunityCard";
import { Appear, Button, Chip, Loading, LogoOrb, Screen, Txt } from "@/components/ui";
import { showError } from "@/lib/errors";
import { markWelcomeDone } from "@/lib/useWelcome";
import { space } from "@/theme";

/** First-run screen: what Kamino stands for, pick interests, join a few communities in one tap. */
export default function Welcome() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const discover = useQuery({ queryKey: ["discover"], queryFn: api.discover });
  const [picked, setPicked] = useState<string[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<string[]>([]);

  const toggle = (category: string) => setPicked((cur) => (cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category]));

  // Only open, public communities with the standard age limit can be joined with one tap.
  const suggestions = (discover.data?.communities ?? [])
    .filter((c) => c.visibility === "public" && c.ageGate <= 13 && (!picked.length || picked.includes(c.category)))
    .slice(0, 8);

  const join = async (community: Community) => {
    setJoining(community.id);
    try {
      await api.join({ slug: community.id });
      setJoined((cur) => [...cur, community.id]);
    } catch (error) {
      showError(error);
    } finally {
      setJoining(null);
    }
  };

  const finish = async () => {
    if (me.data) await markWelcomeDone(me.data.profile.userId);
    await queryClient.invalidateQueries();
    router.replace("/");
  };

  return (
    <Screen topInset>
      <Appear style={{ alignItems: "center", gap: space.sm, paddingTop: space.lg }}>
        <LogoOrb size={64} />
        <Txt variant="display" style={{ textAlign: "center" }}>Welcome to Kamino</Txt>
        <Txt tone="muted" style={{ textAlign: "center" }}>
          A calm place for your communities. No ads, no pushy notifications. Just people who share what you love.
        </Txt>
      </Appear>

      <Appear index={1} style={{ gap: space.sm }}>
        <Txt variant="heading">What are you into?</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {CATEGORIES.map((c) => <Chip key={c} label={c} selected={picked.includes(c)} onPress={() => toggle(c)} />)}
        </View>
      </Appear>

      <View style={{ gap: space.md }}>
        <Txt variant="heading">Communities to try</Txt>
        {discover.isPending ? <Loading /> : suggestions.length ? suggestions.map((c, i) => (
          <Appear key={c.id} index={i + 2} style={{ gap: space.sm }}>
            <CommunityCard community={c} />
            <Button
              label={joined.includes(c.id) ? "Joined ✓" : "Join"}
              small
              variant={joined.includes(c.id) ? "secondary" : "primary"}
              disabled={joined.includes(c.id)}
              busy={joining === c.id}
              onPress={() => void join(c)}
              style={{ alignSelf: "flex-start" }}
            />
          </Appear>
        )) : <Txt tone="muted">No communities match yet. You can create the first one from the Create tab.</Txt>}
      </View>

      <Button label={joined.length ? "Start exploring" : "Skip for now"} variant={joined.length ? "primary" : "secondary"} onPress={() => void finish()} />
    </Screen>
  );
}
