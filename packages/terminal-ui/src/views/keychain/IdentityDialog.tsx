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

import type { IPublicIdentity, IPublicSshKey } from '@termlnk/terminal';
import { LocaleService } from '@termlnk/core';
import { Button, DialogContent, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogPrimitive, DialogTitle, Field, FieldContent, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useDependency } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useState } from 'react';

const NO_KEY = '__none__';

interface IIdentityDialogProps {
  editIdentity?: IPublicIdentity;
  onClose: () => void;
}

const dialogContentCls = `
  tm:w-[min(32rem,calc(100%-2rem))] tm:gap-4 tm:rounded-xl tm:border-line tm:bg-one-bg tm:p-5
  tm:shadow-[0_18px_52px_rgb(0_0_0/0.45)]
`;

export function IdentityDialog({ editIdentity, onClose }: IIdentityDialogProps) {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const [label, setLabel] = useState(editIdentity?.label ?? '');
  const [username, setUsername] = useState(editIdentity?.username ?? '');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState(editIdentity?.keyId ?? NO_KEY);
  const [keys, setKeys] = useState<IPublicSshKey[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    // Only a successful load proves the key is gone; a failed fetch must not look "missing".
    keychain.listKeys().then((list) => {
      setKeys(list);
      setKeysLoaded(true);
    }, () => {});
  }, [keychain]);

  // Warns when the stored keyId no longer resolves — cross-device sync can leave it
  // dangling. Repository-level cascade keeps single-device deletes clean.
  const keyMissing = keysLoaded
    && keyId !== NO_KEY
    && !keys.some((k) => k.id === keyId);

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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [editIdentity, keychain, label, username, password, keyId, onClose]);

  return (
    <DialogPrimitive open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="tm:bg-darker-black/70 tm:backdrop-blur-[1.5px]" />
        <DialogContent
          closable={false}
          className={dialogContentCls}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle className="tm:text-[15px] tm:font-semibold tm:text-white">
              {t(editIdentity ? 'terminal-ui.keychain.identity.editTitle' : 'terminal-ui.keychain.identity.newTitle')}
            </DialogTitle>
          </DialogHeader>

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

          <DialogFooter className="tm:gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('terminal-ui.keychain.action.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!label.trim() || !username.trim() || busy}>
              {t('terminal-ui.keychain.action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </DialogPrimitive>
  );
}
