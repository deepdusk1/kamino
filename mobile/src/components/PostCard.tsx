import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { imageSource } from "@/api/client";
import type { Post, PostType } from "@/api/types";
import { compactCount, plainPreview, timeAgo } from "@/lib/format";
import { usePostActions } from "@/lib/usePostActions";
import { font, radius, space, useTheme } from "@/theme";
import { LikeButton } from "./LikeButton";
import { Avatar, Card, Chip, PressableScale, Txt } from "./ui";

const TYPE_ICON: Record<PostType, keyof typeof Ionicons.glyphMap> = {
  blog: "document-text-outline",
  image: "image-outline",
  poll: "stats-chart-outline",
  quiz: "help-circle-outline",
  wiki: "book-outline",
  story: "time-outline",
  question: "chatbubble-ellipses-outline",
  link: "link-outline",
};

const TYPE_LABEL: Record<PostType, string> = {
  blog: "Blog", image: "Image", poll: "Poll", quiz: "Quiz", wiki: "Wiki", story: "Story", question: "Question", link: "Link",
};

type Props = {
  post: Post & { communityName?: string };
  showCommunity?: boolean;
  /** Position in a feed: cards float in one after another. */
  index?: number;
};

export function PostCard({ post, showCommunity, index }: Props) {
  const theme = useTheme();
  const { liked, likeCount, saved, toggleLike, toggleSave } = usePostActions(post);
  const [revealed, setRevealed] = useState(!post.contentWarning);
  const open = () => router.push(`/community/${post.communityId}/post/${post.id}`);

  return (
    <Card onPress={open} accessibilityLabel={`Open post: ${post.title}`} index={index}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <PressableScale onPress={() => router.push(`/profile/${post.author.handle}`)} accessibilityLabel={`Open ${post.author.nickname}'s profile`} scaleTo={0.9}>
          <Avatar name={post.author.nickname} hue={post.author.hue} size={38} userId={post.author.userId} version={post.author.avatarV} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Txt variant="small" numberOfLines={1} style={{ fontFamily: font.bold }}>{post.author.nickname}</Txt>
          <Txt variant="caption" tone="subtle" numberOfLines={1}>
            {showCommunity && post.communityName ? `${post.communityName} · ` : ""}{timeAgo(post.createdAt)}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.tint, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }} accessibilityLabel={TYPE_LABEL[post.type]}>
          <Ionicons name={TYPE_ICON[post.type]} size={13} color={theme.accent} />
          <Txt variant="caption" tone="accent">{TYPE_LABEL[post.type]}</Txt>
        </View>
      </View>

      {post.announcement || post.featured || post.pinned ? (
        <View style={{ flexDirection: "row", gap: space.xs }}>
          {post.announcement ? <Chip label="Announcement" /> : null}
          {post.pinned ? <Chip label="Pinned" /> : null}
          {post.featured ? <Chip label="Featured" tone="ok" /> : null}
        </View>
      ) : null}

      <Txt variant="heading">{post.title}</Txt>

      {!revealed ? (
        <Pressable onPress={() => setRevealed(true)} accessibilityRole="button" accessibilityLabel="Show content" style={{ backgroundColor: theme.tint, borderRadius: radius.md, padding: space.lg, gap: 4, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="eye-off-outline" size={20} color={theme.accent} style={{ marginRight: space.sm }} />
          <View style={{ flex: 1 }}>
            <Txt variant="small" tone="accent">Content warning: {post.contentWarning}</Txt>
            <Txt variant="caption" tone="muted">Tap to show</Txt>
          </View>
        </Pressable>
      ) : (
        <>
          {post.body ? <Txt tone="muted" numberOfLines={3}>{plainPreview(post.body)}</Txt> : null}
          {post.cover ? (
            <Image source={imageSource(post.cover)} style={{ height: 200, borderRadius: radius.md, backgroundColor: theme.elevated }} contentFit="cover" accessibilityLabel="Post image" transition={220} />
          ) : null}
        </>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingTop: space.xs }}>
        <LikeButton liked={liked} count={compactCount(likeCount)} onPress={() => void toggleLike()} />
        <Action icon="chatbubble-outline" color={theme.muted} label={compactCount(post.commentCount)} onPress={open} a11y="Comments" />
        <View style={{ flex: 1 }} />
        <Action icon={saved ? "bookmark" : "bookmark-outline"} color={saved ? theme.accent : theme.muted} onPress={toggleSave} a11y={saved ? "Remove from saved" : "Save"} />
      </View>
    </Card>
  );
}

function Action({ icon, color, label, onPress, a11y }: { icon: keyof typeof Ionicons.glyphMap; color: string; label?: string; onPress: () => void; a11y: string }) {
  return (
    <PressableScale onPress={onPress} hitSlop={10} accessibilityLabel={a11y} scaleTo={0.85} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={22} color={color} />
      {label ? <Txt variant="small" tone="muted">{label}</Txt> : null}
    </PressableScale>
  );
}
