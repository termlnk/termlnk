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

import type { HostTree, ICredential, IPublicIdentity, IPublicSshKey } from '@termlnk/terminal';
import type { HostFormItem } from '../../../models/host-dialog.state';
import { LocaleService } from '@termlnk/core';
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, useDependency } from '@termlnk/design';
import { IHostManagerService, IKeychainManagerService } from '@termlnk/rpc-client';
import { DEFAULT_HOST_ROOT, getCredentialUsername, HostType } from '@termlnk/terminal';
import { useEffect, useState } from 'react';
import { HostDialogMode } from '../../../models/host-dialog.state';

export interface IBasicInfoTabProps {
  data: HostFormItem;
  mode: HostDialogMode;
  onChange: (data: Partial<HostFormItem>) => void;
  getError: (path: string) => string | undefined;
}

interface IGroupOption {
  id: string;
  label: string;
  depth: number;
}

function flattenGroups(trees: HostTree[], depth = 0): IGroupOption[] {
  const result: IGroupOption[] = [];
  for (const node of trees) {
    if (node.type === HostType.GROUP) {
      result.push({ id: node.id, label: node.label, depth });
      if (node.children?.length) {
        result.push(...flattenGroups(node.children, depth + 1));
      }
    }
  }
  return result;
}

const compactInputCls = 'tm:h-8 tm:px-2 tm:py-1 tm:text-xs';
const credentialTabTriggerCls = 'tm:px-2.5 tm:py-1 tm:text-xs tm:text-white tm:hover:text-blue';

export function BasicInfoTab(props: IBasicInfoTabProps) {
  const { data, mode, onChange, getError } = props;
  const localeService = useDependency(LocaleService);
  const hostManagerService = useDependency(IHostManagerService);
  const keychainService = useDependency(IKeychainManagerService);

  const credentialType = data.credential?.type ?? 'password';
  const isEdit = mode === HostDialogMode.EDIT;
  const passwordPlaceholder = isEdit ? localeService.t('terminal-ui.host-dialog.field.passwordKeepBlank') : '';
  const privateKeyPlaceholder = isEdit
    ? localeService.t('terminal-ui.host-dialog.field.privateKeyKeepBlank')
    : '-----BEGIN RSA PRIVATE KEY-----';

  const [groups, setGroups] = useState<IGroupOption[]>([]);
  const [keys, setKeys] = useState<IPublicSshKey[]>([]);
  const [identities, setIdentities] = useState<IPublicIdentity[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [identitiesLoaded, setIdentitiesLoaded] = useState(false);

  useEffect(() => {
    hostManagerService.tree().then((trees) => {
      setGroups(flattenGroups(trees));
    });
  }, [hostManagerService]);

  useEffect(() => {
    // Only a successful load proves a reference is gone; a failed fetch must not look
    // "missing" and push the user to re-pick a still-valid credential.
    keychainService.listKeys().then((list) => {
      setKeys(list);
      setKeysLoaded(true);
    }, () => {});
    keychainService.listIdentities().then((list) => {
      setIdentities(list);
      setIdentitiesLoaded(true);
    }, () => {});
  }, [keychainService]);

  // Surface a warning when the host references a key / identity that no longer exists
  // locally — cross-device sync can leave host.credential pointing at a deleted row.
  const credentialKeyId = data.credential?.type === 'key' ? data.credential.keyId : null;
  const credentialIdentityId = data.credential?.type === 'identity' ? data.credential.identityId : null;
  const keyMissing = keysLoaded && !!credentialKeyId && !keys.some((k) => k.id === credentialKeyId);
  const identityMissing = identitiesLoaded && !!credentialIdentityId && !identities.some((i) => i.id === credentialIdentityId);

  const handleTypeChange = (type: string) => {
    if (type === 'password' || type === 'rsa') {
      onChange({ credential: { ...data.credential, type } as ICredential });
      return;
    }
    if (type === 'key') {
      onChange({
        credential: {
          type: 'key',
          username: getCredentialUsername(data.credential),
          keyId: data.credential?.type === 'key' ? data.credential.keyId : '',
        },
      });
      return;
    }
    if (type === 'identity') {
      onChange({
        credential: {
          type: 'identity',
          identityId: data.credential?.type === 'identity' ? data.credential.identityId : '',
        },
      });
    }
  };

  return (
    <FieldGroup className="tm:gap-3">
      <Field>
        <FieldLabel>{localeService.t('terminal-ui.host-dialog.field.parentGroup')}</FieldLabel>
        <FieldContent>
          <Select value={data.pid ?? DEFAULT_HOST_ROOT} onValueChange={(v) => onChange({ pid: v })}>
            <SelectTrigger
              className={`
                ${compactInputCls}
                tm:w-full
              `}
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_HOST_ROOT}>
                {localeService.t('terminal-ui.host-dialog.field.rootGroup')}
              </SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  <span style={{ paddingLeft: `${group.depth * 12}px` }}>{group.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field data-invalid={!!getError('label')}>
        <FieldLabel htmlFor="host-label">{localeService.t('terminal-ui.host-dialog.field.label')}</FieldLabel>
        <FieldContent>
          <Input
            id="host-label"
            className={compactInputCls}
            value={data.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={localeService.t('terminal-ui.host-dialog.field.label')}
          />
          <FieldError>{getError('label')}</FieldError>
        </FieldContent>
      </Field>

      <div className="tm:flex tm:gap-3">
        <Field data-invalid={!!getError('addr')} className="tm:flex-1">
          <FieldLabel htmlFor="host-addr">{localeService.t('terminal-ui.host-dialog.field.addr')}</FieldLabel>
          <FieldContent>
            <Input
              id="host-addr"
              className={compactInputCls}
              value={data.addr ?? ''}
              onChange={(e) => onChange({ addr: e.target.value })}
              placeholder="127.0.0.1"
            />
            <FieldError>{getError('addr')}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={!!getError('port')} className="tm:w-24">
          <FieldLabel htmlFor="host-port">{localeService.t('terminal-ui.host-dialog.field.port')}</FieldLabel>
          <FieldContent>
            <Input
              id="host-port"
              className={compactInputCls}
              type="number"
              value={data.port ?? 22}
              onChange={(e) => onChange({ port: Number.parseInt(e.target.value) || 22 })}
              placeholder="22"
            />
            <FieldError>{getError('port')}</FieldError>
          </FieldContent>
        </Field>
      </div>

      <Tabs value={credentialType} onValueChange={handleTypeChange}>
        <TabsList className="tm:h-8 tm:p-0.5">
          <TabsTrigger
            value="password"
            className={credentialTabTriggerCls}
          >
            {localeService.t('terminal-ui.host-dialog.credential.password')}
          </TabsTrigger>
          <TabsTrigger
            value="rsa"
            className={credentialTabTriggerCls}
          >
            {localeService.t('terminal-ui.host-dialog.credential.rsa')}
          </TabsTrigger>
          <TabsTrigger
            value="key"
            className={credentialTabTriggerCls}
          >
            {localeService.t('terminal-ui.host-dialog.credential.key')}
          </TabsTrigger>
          <TabsTrigger
            value="identity"
            className={credentialTabTriggerCls}
          >
            {localeService.t('terminal-ui.host-dialog.credential.identity')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="tm:mt-3">
          <FieldGroup className="tm:gap-3">
            <Field data-invalid={!!getError('credential.username')}>
              <FieldLabel htmlFor="host-username-pwd">{localeService.t('terminal-ui.host-dialog.field.username')}</FieldLabel>
              <FieldContent>
                <Input
                  id="host-username-pwd"
                  className={compactInputCls}
                  value={getCredentialUsername(data.credential)}
                  onChange={(e) => onChange({
                    credential: { ...data.credential, username: e.target.value } as ICredential,
                  })}
                  placeholder="root"
                />
                <FieldError>{getError('credential.username')}</FieldError>
              </FieldContent>
            </Field>

            <Field data-invalid={!!getError('credential.password')}>
              <FieldLabel htmlFor="host-password">{localeService.t('terminal-ui.host-dialog.field.password')}</FieldLabel>
              <FieldContent>
                <Input
                  id="host-password"
                  className={compactInputCls}
                  type="password"
                  value={(data.credential as { password?: string })?.password ?? ''}
                  onChange={(e) => onChange({
                    credential: { ...data.credential, type: 'password', password: e.target.value } as ICredential,
                  })}
                  placeholder={passwordPlaceholder}
                />
                <FieldError>{getError('credential.password')}</FieldError>
              </FieldContent>
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="rsa" className="tm:mt-3">
          <FieldGroup className="tm:gap-3">
            <Field data-invalid={!!getError('credential.username')}>
              <FieldLabel htmlFor="host-username-rsa">{localeService.t('terminal-ui.host-dialog.field.username')}</FieldLabel>
              <FieldContent>
                <Input
                  id="host-username-rsa"
                  className={compactInputCls}
                  value={getCredentialUsername(data.credential)}
                  onChange={(e) => onChange({
                    credential: { ...data.credential, username: e.target.value } as ICredential,
                  })}
                  placeholder="root"
                />
                <FieldError>{getError('credential.username')}</FieldError>
              </FieldContent>
            </Field>

            <Field data-invalid={!!getError('credential.privateKey')}>
              <FieldLabel htmlFor="host-privatekey">{localeService.t('terminal-ui.host-dialog.field.privateKey')}</FieldLabel>
              <FieldContent>
                <Textarea
                  id="host-privatekey"
                  className="tm:min-h-12 tm:px-2 tm:py-1 tm:text-xs"
                  value={(data.credential as { privateKey?: string })?.privateKey ?? ''}
                  onChange={(e) => onChange({
                    credential: { ...data.credential, type: 'rsa', privateKey: e.target.value } as ICredential,
                  })}
                  rows={4}
                  placeholder={privateKeyPlaceholder}
                />
                <FieldError>{getError('credential.privateKey')}</FieldError>
              </FieldContent>
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="key" className="tm:mt-3">
          <FieldGroup className="tm:gap-3">
            <Field data-invalid={!!getError('credential.username')}>
              <FieldLabel htmlFor="host-username-key">{localeService.t('terminal-ui.host-dialog.field.username')}</FieldLabel>
              <FieldContent>
                <Input
                  id="host-username-key"
                  className={compactInputCls}
                  value={getCredentialUsername(data.credential)}
                  onChange={(e) => onChange({
                    credential: { type: 'key', username: e.target.value, keyId: data.credential?.type === 'key' ? data.credential.keyId : '' },
                  })}
                  placeholder="root"
                />
                <FieldError>{getError('credential.username')}</FieldError>
              </FieldContent>
            </Field>

            <Field data-invalid={!!getError('credential.keyId')}>
              <FieldLabel>{localeService.t('terminal-ui.host-dialog.credential.key')}</FieldLabel>
              <FieldContent>
                <Select
                  value={data.credential?.type === 'key' ? data.credential.keyId : ''}
                  onValueChange={(keyId) => onChange({
                    credential: { type: 'key', username: getCredentialUsername(data.credential), keyId },
                  })}
                >
                  <SelectTrigger
                    className={`
                      ${compactInputCls}
                      tm:w-full
                    `}
                    size="sm"
                  >
                    <SelectValue placeholder={localeService.t('terminal-ui.keychain.field.key')} />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError>{getError('credential.keyId')}</FieldError>
                {keyMissing && (
                  <div className="tm:text-[11px] tm:text-yellow">
                    {localeService.t('terminal-ui.host-dialog.credential.keyMissing')}
                  </div>
                )}
              </FieldContent>
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="identity" className="tm:mt-3">
          <FieldGroup className="tm:gap-3">
            <Field data-invalid={!!getError('credential.identityId')}>
              <FieldLabel>{localeService.t('terminal-ui.keychain.tab.identities')}</FieldLabel>
              <FieldContent>
                <Select
                  value={data.credential?.type === 'identity' ? data.credential.identityId : ''}
                  onValueChange={(identityId) => onChange({ credential: { type: 'identity', identityId } })}
                >
                  <SelectTrigger
                    className={`
                      ${compactInputCls}
                      tm:w-full
                    `}
                    size="sm"
                  >
                    <SelectValue placeholder={localeService.t('terminal-ui.keychain.tab.identities')} />
                  </SelectTrigger>
                  <SelectContent>
                    {identities.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError>{getError('credential.identityId')}</FieldError>
                {identityMissing && (
                  <div className="tm:text-[11px] tm:text-yellow">
                    {localeService.t('terminal-ui.host-dialog.credential.identityMissing')}
                  </div>
                )}
              </FieldContent>
            </Field>
          </FieldGroup>
        </TabsContent>
      </Tabs>
    </FieldGroup>
  );
}
