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

import type { IDevice } from '@termlnk/auth';
import { AuthState } from '@termlnk/auth';
import { useRouter } from 'expo-router';
import { Monitor, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthService, useObservable } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { Card } from '../src/ui/card';
import { IconTile } from '../src/ui/icon-tile';
import { ScreenContainer } from '../src/ui/screen-container';
import { ScreenHeader } from '../src/ui/screen-header';

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const auth = useAuthService();
  const authState = useObservable(auth?.authState$, AuthState.Restoring);
  const isAuthenticated = authState === AuthState.Authenticated;
  const [devices, setDevices] = useState<readonly IDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (auth == null || !isAuthenticated) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await auth.listDevices();
      setDevices(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [auth, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadDevices();
    }
  }, [isAuthenticated, loadDevices]);

  const revokeDevice = useCallback(async (device: IDevice) => {
    if (auth == null) {
      return;
    }
    setRevokingId(device.id);
    setError(null);
    try {
      await auth.revokeDevice(device.id);
      await loadDevices();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setRevokingId(null);
    }
  }, [auth, loadDevices]);

  const confirmRevoke = useCallback((device: IDevice) => {
    const label = getDeviceLabel(device);
    Alert.alert('Log out device?', `"${label}" will need to sign in again before it can sync.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => void revokeDevice(device),
      },
    ]);
  }, [revokeDevice]);

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Devices" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        refreshControl={(
          <RefreshControl
            refreshing={loading && devices.length > 0}
            onRefresh={loadDevices}
            tintColor={colors.contentSecondary}
          />
        )}
      >
        <DeviceHero />

        <Text className="mb-3 mt-5 text-[13px] leading-[18px] text-content">Active Devices:</Text>

        {!isAuthenticated && authState !== AuthState.Restoring && (
          <StateCard message="Sign in to manage your devices." />
        )}

        {isAuthenticated && loading && devices.length === 0 && (
          <View className="py-10">
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {isAuthenticated && error != null && (
          <StateCard message={error} tone="error" />
        )}

        {isAuthenticated && !loading && error == null && devices.length === 0 && (
          <StateCard message="No active devices." />
        )}

        {isAuthenticated && devices.length > 0 && (
          <View className="gap-2">
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                revoking={revokingId === device.id}
                onRevoke={confirmRevoke}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function DeviceHero() {
  const colors = useThemeColors();
  return (
    <Card className="px-5 py-8">
      <View className="items-center">
        <View className="h-20 flex-row items-center justify-center gap-3">
          <Monitor size={76} color={colors.accent} strokeWidth={1.8} />
          <Smartphone size={68} color={colors.accent} strokeWidth={1.8} />
        </View>
      </View>
    </Card>
  );
}

interface IDeviceRowProps {
  readonly device: IDevice;
  readonly revoking: boolean;
  readonly onRevoke: (device: IDevice) => void;
}

function DeviceRow({ device, revoking, onRevoke }: IDeviceRowProps) {
  const label = getDeviceLabel(device);
  const Icon = isMobileDevice(device) ? Smartphone : Monitor;
  return (
    <View className="min-h-[60px] flex-row items-center rounded-2xl bg-surface-raised px-3 py-3">
      <IconTile icon={Icon} tone="neutral" size={40} />
      <View className="ml-3 flex-1">
        <Text className="text-[13px] leading-[18px] text-content" numberOfLines={1}>{label}</Text>
        <Text className="mt-0.5 text-[11px] leading-4 text-content-secondary" numberOfLines={1}>
          {device.isCurrent ? 'This device' : `Last active: ${formatDeviceDate(device.lastSeenAt)}`}
        </Text>
      </View>
      {!device.isCurrent && (
        <Pressable
          onPress={() => onRevoke(device)}
          disabled={revoking}
          className="ml-3 rounded-lg px-2 py-1 active:bg-surface-sunken disabled:opacity-50"
        >
          <Text className="text-[12px] font-medium leading-4 text-accent">
            {revoking ? 'Logging Out' : 'Log Out'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function StateCard({ message, tone = 'muted' }: { message: string; tone?: 'muted' | 'error' }) {
  return (
    <View className="rounded-2xl bg-surface-raised px-4 py-3">
      <Text className={tone === 'error' ? 'text-[13px] leading-[18px] text-danger' : 'text-[13px] leading-[18px] text-content-secondary'}>
        {message}
      </Text>
    </View>
  );
}

function getDeviceLabel(device: IDevice): string {
  const name = device.deviceName?.trim();
  if (name) {
    return name;
  }
  return 'Unnamed device';
}

function isMobileDevice(device: IDevice): boolean {
  const signature = `${device.deviceName ?? ''} ${device.userAgent ?? ''}`.toLowerCase();
  return signature.includes('iphone')
    || signature.includes('ipad')
    || signature.includes('android')
    || signature.includes('mobile');
}

function formatDeviceDate(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return iso;
  }
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
