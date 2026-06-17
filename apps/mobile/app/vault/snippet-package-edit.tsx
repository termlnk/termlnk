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

import type { ISnippetEntity } from '@termlnk/database-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSnippetRepository } from '../../src/core/core-context';
import { DangerButton, FieldRow, FormSection, InlineField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';

export default function SnippetPackageEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const snippetRepo = useSnippetRepository();

  const [label, setLabel] = useState('');
  const [original, setOriginal] = useState<ISnippetEntity | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDisabled = useMemo(() => !label.trim(), [label]);

  useEffect(() => {
    if (!id) {
      setOriginal(null);
      setLabel('');
      return;
    }
    let cancelled = false;
    void snippetRepo.getPackageById(id).then((pkg) => {
      if (cancelled || !pkg) {
        return;
      }
      setOriginal(pkg);
      setLabel(pkg.label);
    });
    return () => {
      cancelled = true;
    };
  }, [id, snippetRepo]);

  const onSave = async () => {
    if (!label.trim()) {
      return;
    }
    setBusy(true);
    try {
      await snippetRepo.savePackage(
        {
          ...(id ? { id } : {}),
          label: label.trim(),
          sort: original?.sort ?? 0,
          expanded: original?.expanded ?? true,
        },
        { isNew }
      );
      router.back();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!id) {
      return;
    }
    Alert.alert('Delete Package', 'All snippets in this package will also be deleted. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await snippetRepo.removePackage(id);
          router.back();
        },
      },
    ]);
  };

  const title = isNew ? 'Package' : 'Edit Package';

  return (
    <View style={{ flex: 1 }} className="bg-surface">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <RoundButton icon={X} onPress={() => router.back()} accessibilityLabel="Close" />
        <Text className="text-[16px] font-semibold text-content">{title}</Text>
        <RoundButton
          icon={Check}
          variant="accent"
          onPress={() => void onSave()}
          disabled={confirmDisabled || busy}
          accessibilityLabel="Save"
        />
      </View>
      <FormSection>
        <FieldRow>
          <InlineField label="Name" value={label} onChangeText={setLabel} placeholder="Enter package name" />
        </FieldRow>
      </FormSection>

      {!isNew && (
        <View className="mx-4 mt-8">
          <DangerButton title="Delete Package" onPress={onDelete} />
        </View>
      )}
    </View>
  );
}
