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

import type { IUserAccount } from '@termlnk/auth';
import { Image, Text, View } from 'react-native';

export interface IUserAvatarProps {
  readonly user: IUserAccount | null;
  readonly size?: number;
  readonly radius?: number;
}

export function getUserDisplayName(user: IUserAccount | null): string {
  const displayName = user?.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const email = user?.email.trim();
  if (email) {
    return email.split('@')[0] ?? email;
  }
  return '';
}

export function getUserInitial(user: IUserAccount | null): string {
  const displayName = getUserDisplayName(user);
  return displayName.length > 0 ? displayName[0]!.toUpperCase() : '?';
}

export function UserAvatar({ user, size = 36, radius = 14 }: IUserAvatarProps) {
  const dimension = { width: size, height: size, borderRadius: radius };
  const avatarUrl = user?.avatarUrl?.trim();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        className="bg-surface-sunken"
        style={dimension}
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={[dimension, { backgroundColor: '#2f9e8f' }]}
    >
      <Text
        className="font-bold text-white"
        style={{ fontSize: Math.round(size * 0.42) }}
      >
        {getUserInitial(user)}
      </Text>
    </View>
  );
}
