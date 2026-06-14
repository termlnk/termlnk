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

import type { IPublicSshKey } from '@termlnk/terminal';
import { LocaleService } from '@termlnk/core';
import { Button, Field, FieldContent, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useDependency, useObservable } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IKeychainDialogService } from '../../services/keychain/keychain-dialog.service';

const NO_KEY = '__none__';

export function IdentityDialog() {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const keychainDialog = useDependency(IKeychainDialogService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const dialogState = useObservable(keychainDialog.state$, keychainDialog.getState());
  const editIdentity = dialogState.identity?.identity;

  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState(NO_KEY);
  const [keys, setKeys] = useState<IPublicSshKey[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetKey = dialogState.identity
    ? `edit:${editIdentity?.id ?? 'new'}`
    : '';
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKeyRef.current) {
      return;
    }
    prevResetKeyRef.current = resetKey;

    setError('');
    setBusy(false);
    setPassword('');

    if (!dialogState.identity) {
      setLabel('');
      setUsername('');
      setKeyId(NO_KEY);
      return;
    }
    if (editIdentity) {
      setLabel(editIdentity.label);
      setUsername(editIdentity.username);
      setKeyId(editIdentity.keyId ?? NO_KEY);
    } else {
      setLabel('');
      setUsername('');
      setKeyId(NO_KEY);
    }
  }, [resetKey, dialogState.identity, editIdentity]);

  useEffect(() => {
    if (!editIdentity) {
      return;
    }
    let active = true;
    keychain.revealPassword(editIdentity.id)
      .then((pw) => {
        if (active) {
          setPassword(pw ?? '');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [keychain, editIdentity]);

  useEffect(() => {
    keychain.listKeys().then((list) => {
      setKeys(list);
      setKeysLoaded(true);
    }, () => {});
  }, [keychain]);

  const keyMissing = keysLoaded
    && keyId !== NO_KEY
    && !keys.some((k) => k.id === keyId);

  const handleClose = useCallback(() => {
    keychainDialog.close();
  }, [keychainDialog]);

  const handleSubmit = useCallback(async () => {
    if (!label.trim() || !username.trim()) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const resolvedKeyId = keyId === NO_KEY ? null : keyId;
      if (editIdentity) {
        await keychain.updateIdentity({
          id: editIdentity.id,
          label: label.trim(),
          username: username.trim(),
          password: password || undefined,
          keyId: resolvedKeyId,
        });
      } else {
        await keychain.createIdentity({
          label: label.trim(),
          username: username.trim(),
          password: password || undefined,
          keyId: resolvedKeyId ?? undefined,
        });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [editIdentity, keychain, label, username, password, keyId, handleClose]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      <Field>
        <FieldLabel>{t('terminal-ui.keychain.field.label')}</FieldLabel>
        <FieldContent>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>{t('terminal-ui.keychain.field.username')}</FieldLabel>
        <FieldContent>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>{t('terminal-ui.keychain.field.password')}</FieldLabel>
        <FieldContent>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>{t('terminal-ui.keychain.field.key')}</FieldLabel>
        <FieldContent>
          <Select value={keyId} onValueChange={setKeyId}>
            <SelectTrigger className="tm:w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_KEY}>{t('terminal-ui.keychain.field.noKey')}</SelectItem>
              {keys.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {keyMissing && (
            <div className="tm:mt-1 tm:text-[11px] tm:text-yellow">
              {t('terminal-ui.keychain.identity.keyMissing')}
            </div>
          )}
        </FieldContent>
      </Field>

      {error && <div className="tm:text-[12px] tm:text-red">{error}</div>}

      <div className="tm:flex tm:justify-end tm:gap-2 tm:pt-1">
        <Button variant="outline" size="sm" onClick={handleClose}>{t('terminal-ui.keychain.action.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!label.trim() || !username.trim() || busy}>
          {t('terminal-ui.keychain.action.save')}
        </Button>
      </div>
    </div>
  );
}
