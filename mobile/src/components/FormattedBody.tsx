import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { View } from "react-native";
import { font, space, useTheme } from "@/theme";
import { Txt } from "./ui";

/**
 * Renders the small formatting vocabulary Kamino posts use (same as the website):
 *   # / ## headings, > quotes, - lists, **bold**, _italic_, ~~strike~~, [text](https://link)
 * Nothing else is interpreted, so posted text can never run code or open odd links.
 */
const TOKEN = /(\*\*[^*\n]+\*\*|_[^_\n]+_|~~[^~\n]+~~|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

function inline(text: string, accent: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <Txt key={i} style={{ fontFamily: font.heavy }}>{part.slice(2, -2)}</Txt>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <Txt key={i} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</Txt>;
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) return <Txt key={i} style={{ textDecorationLine: "line-through" }}>{part.slice(2, -2)}</Txt>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (link) return <Txt key={i} style={{ color: accent, textDecorationLine: "underline" }} onPress={() => void Linking.openURL(link[2]!)}>{link[1]}</Txt>;
    return part;
  });
}

export function FormattedBody({ body, formatted }: { body: string; formatted: boolean }) {
  const theme = useTheme();
  if (!formatted) return <Txt selectable>{body}</Txt>;
  return (
    <View style={{ gap: space.sm }}>
      {body.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <Txt key={i} variant="heading" style={{ paddingTop: space.sm }}>{inline(line.slice(3), theme.accent)}</Txt>;
        if (line.startsWith("# ")) return <Txt key={i} variant="title" style={{ paddingTop: space.sm }}>{inline(line.slice(2), theme.accent)}</Txt>;
        if (line.startsWith("> "))
          return (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: theme.accent, paddingLeft: space.md }}>
              <Txt tone="muted">{inline(line.slice(2), theme.accent)}</Txt>
            </View>
          );
        if (line.startsWith("- "))
          return (
            <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
              <Txt>{"•"}</Txt>
              <Txt style={{ flex: 1 }}>{inline(line.slice(2), theme.accent)}</Txt>
            </View>
          );
        return line.trim() ? <Txt key={i} selectable>{inline(line, theme.accent)}</Txt> : <View key={i} style={{ height: space.xs }} />;
      })}
    </View>
  );
}
