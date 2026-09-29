import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, Share, View } from "react-native";
import { apiBaseUrl } from "@/api/config";
import { authHeaders, imageSource, postImageUrl } from "@/api/client";
import { api } from "@/api/endpoints";
import { LikeButton } from "@/components/LikeButton";
import { FormattedBody } from "@/components/FormattedBody";
import { PollView, QuizView } from "@/components/PollAndQuiz";
import { StoryViewer } from "@/components/StoryViewer";
import { ReportSheet, type ReportTarget } from "@/components/ReportSheet";
import { WikiTools } from "@/components/WikiTools";
import { Avatar, Button, Card, Chip, ErrorState, Field, Loading, Screen, Txt } from "@/components/ui";
import { useAction } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { usePostActions } from "@/lib/usePostActions";
import { radius, space, useTheme } from "@/theme";
import { withCommunityTheme } from "@/components/CommunityTheme";

function PostScreen() {
  const theme = useTheme();
  const { slug, postId } = useLocalSearchParams<{ slug: string; postId: string }>();
  const id = Number(postId);
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["post", id], queryFn: () => api.post(slug!, id), enabled: !!slug && Number.isFinite(id) });
  const me = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });

  const [comment, setComment] = useState("");
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const [send, sending] = useAction(async () => {
    await api.comment(id, comment.trim());
    setComment("");
    await queryClient.invalidateQueries({ queryKey: ["post", id] });
  });
  const [saveEdit, savingEdit] = useAction(async () => {
    await api.editPost({ slug: slug!, postId: id, title: editTitle, body: editBody });
    setEditing(false);
    await queryClient.invalidateQueries({ queryKey: ["post", id] });
  });
  const [remove, removing] = useAction(async () => {
    await api.deletePost(slug!, id);
    await queryClient.invalidateQueries();
    router.back();
  });
  const [flag] = useAction(async (flags: Parameters<typeof api.setPostFlags>[0]) => {
    await api.setPostFlags(flags);
    await queryClient.invalidateQueries({ queryKey: ["post", id] });
  });
  const [feature] = useAction(async () => { await api.featurePost(slug!, id); await queryClient.invalidateQueries({ queryKey: ["post", id] }); });
  const [repost] = useAction(async () => { await api.repost(slug!, id); Alert.alert("Reposted", "Shared to your followers in this community."); });
  const [likeComment] = useAction(async (commentId: number) => { await api.likeComment(commentId); await queryClient.invalidateQueries({ queryKey: ["post", id] }); });

  const post = q.data?.post;
  const actions = usePostActions(post ?? { id, liked: false, likeCount: 0, saved: false });

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data || !post) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const page = q.data;
  const myId = me.data?.profile?.userId;
  const isAuthor = post.author.userId === myId;
  const member = page.member;
  const isMember = member?.status === "active";
  const isModerator = isMember && ["leader", "agent", "curator"].includes(member!.role);
  const formatted = post.payload.format === "markdown";
  const showBody = !post.contentWarning || revealed;

  const openMenu = () => {
    const options: { label: string; run: () => void; destructive?: boolean }[] = [
      { label: "Share", run: () => void Share.share({ message: `${post.title}\n${apiBaseUrl()}/c/${slug}/p/${id}` }) },
      ...(isMember && !isAuthor ? [{ label: "Repost", run: () => void repost() }] : []),
      ...(isAuthor && post.type !== "poll" && post.type !== "quiz" ? [{ label: "Edit", run: () => { setEditTitle(post.title); setEditBody(post.body); setEditing(true); } }] : []),
      ...(isModerator ? [
        { label: post.pinned ? "Unpin" : "Pin to top", run: () => void flag({ slug: slug!, postId: id, pinned: !post.pinned }) },
        { label: post.featured ? "Unfeature" : "Feature", run: () => void feature() },
        { label: post.hidden ? "Unhide" : "Hide", run: () => void flag({ slug: slug!, postId: id, hidden: !post.hidden }) },
        { label: post.commentsDisabled ? "Open comments" : "Close comments", run: () => void flag({ slug: slug!, postId: id, commentsDisabled: !post.commentsDisabled }) },
      ] : []),
      ...(!isAuthor ? [{ label: "Report", run: () => setReport({ targetType: "post", targetId: String(id), communityId: slug, label: "post" }) }] : []),
      ...(isAuthor || isModerator ? [{ label: "Delete", destructive: true, run: () => Alert.alert("Delete this post?", "This can't be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void remove() }]) }] : []),
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length, destructiveButtonIndex: options.findIndex((o) => o.destructive) },
        (i) => options[i]?.run(),
      );
    } else {
      Alert.alert("Post options", undefined, [...options.map((o) => ({ text: o.label, style: o.destructive ? ("destructive" as const) : ("default" as const), onPress: o.run })), { text: "Cancel", style: "cancel" as const }]);
    }
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: page.community.name, headerRight: () => (
        <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="Post options" hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.fg} />
        </Pressable>
      ) }} />

      <Pressable onPress={() => router.push(`/profile/${post.author.handle}`)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={post.author.nickname} hue={post.author.hue} size={44} userId={post.author.userId} version={post.author.avatarV} />
        <View style={{ flex: 1 }}>
          <Txt>{post.author.nickname}</Txt>
          <Txt variant="caption" tone="subtle">{timeAgo(post.createdAt)}{post.editedAt ? " · edited" : ""}</Txt>
        </View>
      </Pressable>

      {post.hidden ? <Chip label="Hidden from members" tone="danger" /> : null}
      <Txt variant="title">{post.title}</Txt>

      {post.type === "wiki" ? <WikiTools page={page} isAuthor={isAuthor} isModerator={isModerator} isMember={isMember} /> : null}

      {!showBody ? (
        <Pressable onPress={() => setRevealed(true)} accessibilityRole="button" style={{ backgroundColor: theme.tint, borderRadius: radius.md, padding: space.lg }}>
          <Txt tone="accent">Content warning: {post.contentWarning}</Txt>
          <Txt variant="caption" tone="muted">Tap to show</Txt>
        </Pressable>
      ) : (
        <>
          {post.type === "story" && post.cover ? (
            <StoryViewer
              scenes={[imageSource(post.cover), ...Array.from({ length: post.payload.albumCount ?? 0 }, (_, i) => ({ uri: postImageUrl(post.id, i + 1), headers: authHeaders() }))]}
              captions={post.payload.captions}
            />
          ) : post.cover ? <Image source={imageSource(post.cover)} style={{ height: 240, borderRadius: radius.lg, backgroundColor: theme.elevated }} contentFit="cover" accessibilityLabel="Post image" /> : null}
          {post.type !== "story" && post.payload.albumCount ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {Array.from({ length: post.payload.albumCount }, (_, i) => i + 1).map((n) => (
                <Image
                  key={n}
                  source={{ uri: postImageUrl(post.id, n), headers: authHeaders() }}
                  style={{ width: "31.5%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: theme.elevated }}
                  contentFit="cover"
                  cachePolicy="disk"
                  accessibilityLabel={`Picture ${n + 1} of ${post.payload.albumCount! + 1}`}
                />
              ))}
            </View>
          ) : null}
          {editing ? (
            <Card>
              <Field label="Title" value={editTitle} onChangeText={setEditTitle} maxLength={120} />
              <Field label="Text" value={editBody} onChangeText={setEditBody} multiline maxLength={8000} style={{ minHeight: 160 }} />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button label="Save" small onPress={() => void saveEdit()} busy={savingEdit} />
                <Button label="Cancel" small variant="secondary" onPress={() => setEditing(false)} />
              </View>
            </Card>
          ) : post.body ? <FormattedBody body={post.body} formatted={formatted} /> : null}
          {post.type === "link" && post.payload.url ? <Button label="Open link" variant="secondary" onPress={() => void Linking.openURL(post.payload.url!)} /> : null}
        </>
      )}

      {post.type === "poll" && page.poll ? <PollView postId={id} poll={page.poll} canVote={isMember} /> : null}
      {post.type === "quiz" && post.payload.questions ? <QuizView postId={id} questions={post.payload.questions} timeLimitSec={post.payload.timeLimitSec ?? 0} quizRun={page.quizRun} myQuiz={page.myQuiz} board={page.quizBoard} canPlay={isMember} /> : null}

      {post.hashtags.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>{post.hashtags.map((t) => <Chip key={t} label={`#${t}`} onPress={() => router.push({ pathname: "/explore", params: { q: `#${t}` } })} />)}</View> : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xl }}>
        <LikeButton liked={actions.liked} count={actions.likeCount} onPress={() => void actions.toggleLike()} size={26} />
        <Pressable onPress={actions.toggleSave} accessibilityRole="button" accessibilityLabel={actions.saved ? "Remove from saved" : "Save"} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Ionicons name={actions.saved ? "bookmark" : "bookmark-outline"} size={24} color={actions.saved ? theme.accent : theme.muted} />
          <Txt tone="muted">{actions.saved ? "Saved" : "Save"}</Txt>
        </Pressable>
      </View>

      <View style={{ gap: space.md }}>
        <Txt variant="heading">Comments · {page.comments.length}</Txt>
        {page.comments.map((c) => (
          <View key={c.id} style={{ flexDirection: "row", gap: space.md }}>
            <Avatar name={c.author.nickname} hue={c.author.hue} size={32} userId={c.author.userId} version={c.author.avatarV} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="small">{c.author.nickname} <Txt variant="caption" tone="subtle">{timeAgo(c.createdAt)}</Txt></Txt>
              <Txt selectable>{c.body}</Txt>
              <View style={{ flexDirection: "row", gap: space.lg, paddingTop: 2 }}>
                <Pressable onPress={() => void likeComment(c.id)} accessibilityRole="button" accessibilityLabel={c.liked ? "Unlike comment" : "Like comment"} hitSlop={8} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Ionicons name={c.liked ? "heart" : "heart-outline"} size={16} color={c.liked ? theme.danger : theme.subtle} />
                  <Txt variant="caption" tone="subtle">{c.likeCount || ""}</Txt>
                </Pressable>
                {c.author.userId !== myId ? (
                  <Pressable onPress={() => setReport({ targetType: "comment", targetId: `${id}/${c.id}`, communityId: slug, label: "comment" })} accessibilityRole="button" accessibilityLabel="Report comment" hitSlop={8}>
                    <Txt variant="caption" tone="subtle">Report</Txt>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}
        {post.commentsDisabled ? (
          <Txt tone="muted">Comments are closed on this post.</Txt>
        ) : isMember ? (
          <View style={{ gap: space.sm }}>
            <Field value={comment} onChangeText={setComment} placeholder="Add a comment" multiline maxLength={2000} />
            <Button label="Post comment" small disabled={!comment.trim()} onPress={() => void send()} busy={sending} style={{ alignSelf: "flex-end" }} />
          </View>
        ) : (
          <Txt tone="muted">Join this community to comment.</Txt>
        )}
      </View>
      {removing ? <Loading label="Deleting…" /> : null}
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

export default withCommunityTheme(PostScreen);
