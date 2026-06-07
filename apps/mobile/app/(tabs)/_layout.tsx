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

import { Tabs } from 'expo-router';
import { History, KeyRound, Server, Settings as SettingsIcon } from 'lucide-react-native';

// Base46 onedark colors hard-coded here because Tabs.screenOptions accepts
// only inline styles, not Tailwind class names. Keep these in sync with
// tailwind.config.js if the palette ever shifts.
const BG = '#1e222a';
const BORDER = '#31353d';
const ACTIVE = '#61afef';
const INACTIVE = '#565c64';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: BG },
        headerTintColor: '#6f737b',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        sceneStyle: { backgroundColor: BG },
      }}
    >
      <Tabs.Screen
        name="hosts"
        options={{
          title: 'Hosts',
          tabBarIcon: ({ color, size }) => <Server color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="keychain"
        options={{
          title: 'Keychain',
          tabBarIcon: ({ color, size }) => <KeyRound color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Recent',
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
