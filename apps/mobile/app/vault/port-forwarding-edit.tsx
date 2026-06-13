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

import type { PortForwardingType } from '@termlnk/database-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHostRepository, useObservable, usePortForwardingService } from '../../src/core/core-context';
import { takePendingHostSelection } from '../../src/hosts/host-selection';
import { DiagramFigure } from '../../src/port-forwarding/diagram-figure';
import { TypeTabBar } from '../../src/port-forwarding/type-tab-bar';
import { DangerButton, FieldRow, FormSection, InlineField, NavField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

export default function PortForwardingEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;

  const pfService = usePortForwardingService();
  const hostRepo = useHostRepository();
  const hosts = useObservable(hostRepo.hosts$, []);

  const [type, setType] = useState<PortForwardingType>('local');
  const [label, setLabel] = useState('');
  const [hostId, setHostId] = useState('');
  const [bindAddress, setBindAddress] = useState('127.0.0.1');
  const [bindPort, setBindPort] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const hostLabel = useMemo(() => {
    if (!hostId) {
      return '';
    }
    const h = hosts.find((x) => x.id === hostId);
    return h?.label ?? hostId;
  }, [hostId, hosts]);

  const confirmDisabled = useMemo(() => {
    if (!hostId || !bindPort.trim()) {
      return true;
    }
    const bp = Number.parseInt(bindPort, 10);
    if (Number.isNaN(bp) || bp < 0 || bp > 65535) {
      return true;
    }
    if (type !== 'dynamic') {
      if (!destinationAddress.trim() || !destinationPort.trim()) {
        return true;
      }
      const dp = Number.parseInt(destinationPort, 10);
      if (Number.isNaN(dp) || dp < 1 || dp > 65535) {
        return true;
      }
    }
    return false;
  }, [hostId, bindPort, type, destinationAddress, destinationPort]);

  useEffect(() => {
    void hostRepo.ready();
  }, [hostRepo]);

  useEffect(() => {
    if (!id || loaded) {
      return;
    }
    void pfService.getRule(id).then((rule) => {
      if (!rule) {
        return;
      }
      setType(rule.type as PortForwardingType);
      setLabel(rule.label);
      setHostId(rule.hostId);
      setBindAddress(rule.bindAddress);
      setBindPort(String(rule.bindPort));
      setDestinationAddress(rule.destinationAddress ?? '');
      setDestinationPort(rule.destinationPort != null ? String(rule.destinationPort) : '');
      setLoaded(true);
    });
  }, [id, pfService, loaded]);

  useFocusEffect(
    useCallback(() => {
      const selection = takePendingHostSelection();
      if (selection != null) {
        setHostId(selection.hostId);
      }
    }, [])
  );

  const onPickHost = useCallback(() => {
    router.push('/vault/port-forwarding-host-picker');
  }, [router]);

  const validate = (): boolean => {
    if (!hostId) {
      Alert.alert('Missing Host', 'Please select a host.');
      return false;
    }
    const bp = Number.parseInt(bindPort, 10);
    if (Number.isNaN(bp) || bp < 0 || bp > 65535) {
      Alert.alert('Invalid Port', 'Bind port must be between 0 and 65535.');
      return false;
    }
    if (type !== 'dynamic') {
      if (!destinationAddress.trim()) {
        Alert.alert('Missing Destination', 'Please enter a destination address.');
        return false;
      }
      const dp = Number.parseInt(destinationPort, 10);
      if (Number.isNaN(dp) || dp < 1 || dp > 65535) {
        Alert.alert('Invalid Port', 'Destination port must be between 1 and 65535.');
        return false;
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!validate()) {
      return;
    }
    setBusy(true);
    try {
      await pfService.saveRule(
        {
          ...(id ? { id } : {}),
          label,
          type,
          hostId,
          bindAddress: bindAddress || '127.0.0.1',
          bindPort: Number.parseInt(bindPort, 10),
          destinationAddress: type !== 'dynamic' ? destinationAddress : null,
          destinationPort: type !== 'dynamic' ? Number.parseInt(destinationPort, 10) : null,
          sort: 0,
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
    Alert.alert('Delete Rule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await pfService.removeRule(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title={isNew ? 'Create Rule' : 'Edit Rule'}
        onBack={() => router.back()}
        right={<RoundButton icon={Check} variant="accent" onPress={onSave} accessibilityLabel="Save rule" disabled={confirmDisabled || busy} />}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <TypeTabBar value={type} onChange={setType} />

          <DiagramFigure type={type} />

          {type === 'local' && (
            <FormSection>
              <FieldRow><InlineField label="Label" value={label} onChangeText={setLabel} placeholder="Optional" /></FieldRow>
              <FieldRow><InlineField label="Local Port" value={bindPort} onChangeText={setBindPort} placeholder="Required" keyboardType="numeric" /></FieldRow>
              <FieldRow><InlineField label="Bind Address" value={bindAddress} onChangeText={setBindAddress} placeholder="127.0.0.1" /></FieldRow>
              <NavField label="Intermediate Host" value={hostLabel || 'Required'} onPress={onPickHost} />
              <FieldRow><InlineField label="Destination address" value={destinationAddress} onChangeText={setDestinationAddress} placeholder="Required" /></FieldRow>
              <FieldRow last><InlineField label="Destination port number" value={destinationPort} onChangeText={setDestinationPort} placeholder="Required" keyboardType="numeric" /></FieldRow>
            </FormSection>
          )}

          {type === 'remote' && (
            <FormSection>
              <FieldRow><InlineField label="Label" value={label} onChangeText={setLabel} placeholder="Optional" /></FieldRow>
              <NavField label="Remote host" value={hostLabel || 'Required'} onPress={onPickHost} />
              <FieldRow><InlineField label="Remote port number" value={bindPort} onChangeText={setBindPort} placeholder="Required" keyboardType="numeric" /></FieldRow>
              <FieldRow><InlineField label="Bind Address" value={bindAddress} onChangeText={setBindAddress} placeholder="Optional" /></FieldRow>
              <FieldRow><InlineField label="Destination address" value={destinationAddress} onChangeText={setDestinationAddress} placeholder="Required" /></FieldRow>
              <FieldRow last><InlineField label="Destination port number" value={destinationPort} onChangeText={setDestinationPort} placeholder="Required" keyboardType="numeric" /></FieldRow>
            </FormSection>
          )}

          {type === 'dynamic' && (
            <FormSection>
              <FieldRow><InlineField label="Label" value={label} onChangeText={setLabel} placeholder="Optional" /></FieldRow>
              <FieldRow><InlineField label="Local Port" value={bindPort} onChangeText={setBindPort} placeholder="Required" keyboardType="numeric" /></FieldRow>
              <FieldRow><InlineField label="Bind Address" value={bindAddress} onChangeText={setBindAddress} placeholder="127.0.0.1" /></FieldRow>
              <NavField label="Intermediate Host" value={hostLabel || 'Required'} onPress={onPickHost} last />
            </FormSection>
          )}

          {!isNew && (
            <View className="mx-4 mt-8">
              <DangerButton title="Delete Rule" onPress={onDelete} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
