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

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, FolderPlus } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObservable, useSnippetRepository } from '../../src/core/core-context';
import { setPendingPackageSelection } from '../../src/snippets/package-selection';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { IconTile } from '../../src/ui/icon-tile';
import { NavRow } from '../../src/ui/rows';

export default function SnippetPackagePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ selectedId?: string }>();
  const snippetRepo = useSnippetRepository();
  const packages = useObservable(snippetRepo.packages$, []);

  useEffect(() => {
    void snippetRepo.ready();
  }, [snippetRepo]);

  const selectedId = params.selectedId ?? '';

  const pick = (packageId: string, label: string) => {
    setPendingPackageSelection({ packageId, label });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Package' }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 96, paddingBottom: insets.bottom + 32 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <Card dividerInset={64}>
          <NavRow
            leading={<View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken" />}
            title="No package"
            showChevron={false}
            onPress={() => pick('', 'No package')}
            trailing={selectedId === '' ? <Check size={20} color={colors.accent} /> : undefined}
          />
          {packages.map((pkg) => (
            <NavRow
              key={pkg.id}
              leading={<IconTile icon={FolderPlus} tone="snippets" />}
              title={pkg.label}
              showChevron={false}
              onPress={() => pick(pkg.id, pkg.label)}
              trailing={selectedId === pkg.id ? <Check size={20} color={colors.accent} /> : undefined}
            />
          ))}
        </Card>
      </ScrollView>
    </>
  );
}
