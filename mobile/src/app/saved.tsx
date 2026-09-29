import { useQuery } from "@tanstack/react-query";
import { FlatList } from "react-native";
import { api } from "@/api/endpoints";
import { PostCard } from "@/components/PostCard";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { space } from "@/theme";

export default function Saved() {
  const saved = useQuery({ queryKey: ["saved"], queryFn: api.saved });
  if (saved.isPending) return <Loading />;
  if (saved.isError) return <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />;
  return (
    <FlatList
      data={saved.data}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
      refreshing={saved.isRefetching}
      onRefresh={() => void saved.refetch()}
      renderItem={({ item }) => <PostCard post={item} showCommunity />}
      ListEmptyComponent={<EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Tap the bookmark on any post to keep it here." />}
    />
  );
}
