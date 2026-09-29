// The Create tab only opens the "New community" screen (see the tabPress handler in _layout.tsx).
// This file must exist so the tab has a route.
import { Redirect } from "expo-router";

export default function Create() {
  return <Redirect href="/new-community" />;
}
