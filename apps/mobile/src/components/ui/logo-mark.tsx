/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import Svg, { Defs, G, Line, LinearGradient, Polyline, Rect, Stop } from 'react-native-svg';

interface ILogoMarkProps {
  readonly size?: number;
}

export function LogoMark({ size = 72 }: ILogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="logoBg" x1="128" y1="128" x2="896" y2="896">
          <Stop offset="0" stopColor="#2A2A2A" />
          <Stop offset="1" stopColor="#1E1E1E" />
        </LinearGradient>
        <LinearGradient id="logoBorder" x1="96" y1="96" x2="928" y2="928">
          <Stop offset="0" stopColor="#FF6B9D" />
          <Stop offset="0.35" stopColor="#C084FC" />
          <Stop offset="0.65" stopColor="#60A5FA" />
          <Stop offset="1" stopColor="#38BDF8" />
        </LinearGradient>
      </Defs>
      <Rect x="96" y="96" width="832" height="832" rx="210" fill="url(#logoBorder)" />
      <Rect x="150" y="150" width="724" height="724" rx="170" fill="url(#logoBg)" />
      <G transform="translate(240 260) scale(1.08)">
        <Polyline
          points="112,117 168,175 112,233"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="52"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line x1="220" y1="233" x2="350" y2="233" stroke="#FFFFFF" strokeWidth="52" strokeLinecap="round" />
      </G>
    </Svg>
  );
}
