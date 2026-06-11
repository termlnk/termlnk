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

import { useRouter } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { View } from 'react-native';
import { EmptyState } from '../../src/ui/empty-state';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

// Port forwarding has no backing service yet — UI shell only.
export default function PortForwardingScreen() {
  const router = useRouter();
  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Port Forwarding" onBack={() => router.back()} />
      <View className="flex-1 justify-center">
        <EmptyState
          icon={ArrowLeftRight}
          title="No port forwarding rules"
          description="Forward local or remote ports over your SSH connections. Coming soon."
        />
      </View>
    </ScreenContainer>
  );
}
