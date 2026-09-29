import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { ChatMessage } from "@/api/types";
import { Avatar, Txt } from "@/components/ui";
import { bubbleLook } from "@/lib/cosmetics";
import { timeAgo } from "@/lib/format";
import { parseSticker, previewText, stickerEmoji } from "@/lib/stickers";
import { radius, space, useTheme } from "@/theme";
import { MessageMedia } from "./MessageMedia";

type Props = {
  message: ChatMessage;
  mine: boolean;
  /** The message this one replies to, if it is in the loaded history. */
  replyTo?: ChatMessage;
  onLongPress: () => void;
  onOpenProfile: () => void;
  onReact: (emoji: string) => void;
};

export function MessageBubble({ message, mine, replyTo, onLongPress, onOpenProfile, onReact }: Props) {
  const theme = useTheme();
  // Your own messages glow with the brand gradient; other people's are frosted glass in their chosen colour.
  // A non-"soft" style the author picked (glass, outline, bold) replaces both looks.
  const look = bubbleLook(message.bubbleStyle, message.bubbleHue, theme.dark);
  const styled = message.bubbleStyle !== "soft";
  const bubble = styled ? look.background : mine ? "transparent" : look.background;
  const textTone = mine && !styled ? "onAccent" : "default";
  const textColor = styled && look.color ? look.color : undefined;
  // A sticker is shown big and bare, without a bubble around it.
  const sticker = message.deleted ? null : parseSticker(message.body);

  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingVertical: 3 }}>
      {mine ? null : (
        <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`Open ${message.author.nickname}'s profile`}>
          <Avatar name={message.author.nickname} hue={message.author.hue} size={30} userId={message.author.userId} version={message.author.avatarV} />
        </Pressable>
      )}
      <View style={{ maxWidth: "78%", alignItems: mine ? "flex-end" : "flex-start", gap: 2 }}>
        {mine ? null : <Txt variant="caption" tone="muted">{message.author.nickname}</Txt>}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={250}
          accessibilityRole="button"
          accessibilityLabel={`${message.author.nickname}: ${message.deleted ? "deleted message" : previewText(message.body) || "attachment"}. Long press for options.`}
          style={{
            backgroundColor: message.deleted || sticker ? "transparent" : bubble,
            borderRadius: radius.lg,
            // A smaller corner on the speaker's side, like a speech bubble's tail.
            borderBottomRightRadius: mine ? 6 : radius.lg,
            borderBottomLeftRadius: mine ? radius.lg : 6,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            gap: 6,
            overflow: "hidden",
            borderWidth: sticker ? 0 : message.deleted ? 1 : styled ? look.borderWidth : mine ? 0 : StyleSheet.hairlineWidth,
            borderColor: message.deleted ? theme.border : styled && look.borderColor ? look.borderColor : theme.hairline,
          }}
        >
          {mine && !styled && !message.deleted && !sticker ? <LinearGradient colors={theme.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
          {replyTo ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? theme.accentFg : theme.accent, paddingLeft: space.sm, opacity: 0.85 }}>
              <Txt variant="caption" tone={textTone}>{replyTo.author.nickname}</Txt>
              <Txt variant="small" tone={textTone} numberOfLines={2}>{replyTo.deleted ? "Deleted message" : previewText(replyTo.body) || "Attachment"}</Txt>
            </View>
          ) : null}
          {message.deleted ? (
            <Txt variant="small" tone="subtle" style={{ fontStyle: "italic" }}>Message deleted</Txt>
          ) : (
            <>
              {message.mediaKind ? <MessageMedia roomId={message.roomId} messageId={message.id} kind={message.mediaKind} /> : null}
              {sticker ? <Txt accessibilityLabel="Sticker" style={{ fontSize: 64, lineHeight: 76 }}>{stickerEmoji(sticker)}</Txt> : message.body ? <Txt tone={textTone} style={textColor ? { color: textColor } : undefined}>{message.body}</Txt> : null}
            </>
          )}
        </Pressable>
        {message.reactions.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {message.reactions.map((r) => (
              <Pressable key={r.emoji} onPress={() => onReact(r.emoji)} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ", you reacted" : ""}`} style={{ flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: r.mine ? theme.tint : theme.glass, borderWidth: 1, borderColor: r.mine ? theme.accent : theme.hairline }}>
                <Txt variant="caption">{r.emoji}</Txt>
                <Txt variant="caption" tone="muted">{r.count}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Txt variant="caption" tone="subtle">{timeAgo(message.createdAt)}{message.editedAt && !message.deleted ? " · edited" : ""}</Txt>
      </View>
    </Animated.View>
  );
}
