import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** The Kamino "K" logo. */
export function KMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Kamino">
      <Defs>
        <LinearGradient id="k" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#b49aff" />
          <Stop offset="0.6" stopColor="#8c70ef" />
          <Stop offset="1" stopColor="#63d7cf" />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="2" width="60" height="60" rx="20" fill="url(#k)" />
      <Path d="M20 17v30M43 17 27 32l17 15" fill="none" stroke="#171226" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="49" cy="13" r="4" fill="#e9fff9" />
    </Svg>
  );
}
