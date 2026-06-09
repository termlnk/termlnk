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
import { Braces } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import { TextLinkButton } from '../../src/ui/buttons';
import { EmptyState } from '../../src/ui/empty-state';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

// Snippets have no backing service yet — UI shell only.
export default function SnippetsScreen() {
  const router = useRouter();
  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Snippets" onBack={() => router.back()} />
      <View className="flex-1 justify-center">
        <EmptyState
          icon={Braces}
          title="There are no snippets"
          description="Save your frequently used commands as snippets for easy execution in the future."
        />
        <View className="mt-2 px-8">
          <TextLinkButton title="Create snippet" onPress={() => Alert.alert('Snippets', 'Creating snippets is coming soon.')} />
        </View>
      </View>
    </ScreenContainer>
  );
}
