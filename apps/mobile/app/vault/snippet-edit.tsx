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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObservable, useSnippetRepository } from '../../src/core/core-context';
import { takePendingPackageSelection } from '../../src/snippets/package-selection';
import { DangerButton, FieldRow, FormSection, InlineField, NavField, TextField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';

const HEADER_HEIGHT = 60;

export default function SnippetEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;

  const snippetRepo = useSnippetRepository();
  const packages = useObservable(snippetRepo.packages$, []);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [packageId, setPackageId] = useState<string | undefined>(undefined);
  const [original, setOriginal] = useState<ISnippetEntity | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDisabled = useMemo(() => {
    return !label.trim();
  }, [label]);

  const packageLabel = useMemo(() => {
    if (!packageId) {
      return '';
    }
    const pkg = packages.find((p) => p.id === packageId);
    return pkg?.label ?? '';
  }, [packageId, packages]);

  useEffect(() => {
    void snippetRepo.ready();
  }, [snippetRepo]);

  useEffect(() => {
    if (!id) {
      setOriginal(null);
      setLabel('');
      setDescription('');
      setContent('');
      setPackageId(undefined);
      return;
    }
    let cancelled = false;
    void snippetRepo.getSnippetById(id).then((snippet) => {
      if (cancelled || !snippet) {
        return;
      }
      setOriginal(snippet);
      setLabel(snippet.label);
      setDescription(snippet.description ?? '');
      setContent(snippet.content ?? '');
      setPackageId(snippet.pid === 'root' ? undefined : snippet.pid);
    });
    return () => {
      cancelled = true;
    };
  }, [id, snippetRepo]);

  useFocusEffect(
    useCallback(() => {
      const selection = takePendingPackageSelection();
      if (selection != null) {
        setPackageId(selection.packageId || undefined);
      }
    }, [])
  );

  const onSave = async () => {
    if (!label.trim()) {
      return;
    }
    setBusy(true);
    try {
      await snippetRepo.saveSnippet(
        {
          ...(id ? { id } : {}),
          label,
          content,
          description: description || null,
          pid: packageId ?? 'root',
          targetHostIds: original?.targetHostIds ?? null,
          sort: original?.sort ?? 0,
          favorite: original?.favorite ?? false,
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
    Alert.alert('Delete Snippet', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await snippetRepo.removeSnippet(id);
          router.back();
        },
      },
    ]);
  };

  const title = isNew ? 'New Snippet' : 'Edit Snippet';

  const header = (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, height: HEADER_HEIGHT }}
      className="flex-row items-center justify-between bg-surface px-4 pb-2 pt-4"
    >
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
  );

  return (
    <View style={{ flex: 1 }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection>
          <FieldRow><InlineField label="Name" value={label} onChangeText={setLabel} placeholder="Enter snippet name" /></FieldRow>
          <FieldRow><InlineField label="Description" value={description} onChangeText={setDescription} placeholder="Optional" /></FieldRow>
          <NavField
            label="Package"
            value={packageLabel || 'No package'}
            onPress={() => router.push({ pathname: '/vault/snippet-package-picker', params: { selectedId: packageId ?? '' } })}
          />
          <TextField label="Script" value={content} onChangeText={setContent} placeholder="Enter script" multiline last />
        </FormSection>

        {!isNew && (
          <View className="mx-4 mt-8">
            <DangerButton title="Delete Snippet" onPress={onDelete} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
