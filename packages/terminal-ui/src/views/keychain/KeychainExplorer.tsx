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
import { Badge, Button, cn, Tabs, TabsContent, TabsList, TabsTrigger, useDependency } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { IContextMenuService } from '@termlnk/ui';
import { CirclePlus, FileKey2, KeyRound, Pencil, Trash2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { KEYCHAIN_ADD_MENU } from '../../controllers/keychain/add-menu';
import { IKeychainDialogService } from '../../services/keychain/keychain-dialog.service';

type KeychainTab = 'keys' | 'identities';

export function KeychainExplorer() {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const contextMenuService = useDependency(IContextMenuService);
  const dialogService = useDependency(IKeychainDialogService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const [tab, setTab] = useState<KeychainTab>('keys');
  const [keys, setKeys] = useState<IPublicSshKey[]>([]);
  const [identities, setIdentities] = useState<IPublicIdentity[]>([]);
  const [error, setError] = useState('');

  const reloadKeys = useCallback(() => {
    keychain.listKeys().then(setKeys).catch(() => {});
  }, [keychain]);
  const reloadIdentities = useCallback(() => {
    keychain.listIdentities().then(setIdentities).catch(() => {});
  }, [keychain]);

  useEffect(() => {
    reloadKeys();
    reloadIdentities();
    const subKeys = keychain.onKeysChanged$().subscribe(reloadKeys);
    const subIdentities = keychain.onIdentitiesChanged$().subscribe(reloadIdentities);
    return () => {
      subKeys.unsubscribe();
      subIdentities.unsubscribe();
    };
  }, [keychain, reloadKeys, reloadIdentities]);

  const deleteKey = useCallback(async (id: string) => {
    setError('');
    try {
      await keychain.deleteKey(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [keychain]);

  const deleteIdentity = useCallback(async (id: string) => {
    setError('');
    try {
      await keychain.deleteIdentity(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [keychain]);

  return (
    <div className="tm:flex tm:size-full tm:flex-col tm:text-light-grey">
      <div
        className={`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `}
      >
        <div className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden tm:text-white">
          {t('terminal-ui.keychain.title')}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => contextMenuService.triggerContextMenu(e.nativeEvent, KEYCHAIN_ADD_MENU)}
        >
          <CirclePlus strokeWidth={1.5} size={14} />
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as KeychainTab)}
        className="tm:flex tm:min-h-0 tm:flex-1 tm:flex-col"
      >
        <div className="tm:px-2 tm:pb-2">
          <TabsList className="tm:h-7 tm:w-full tm:p-0.5">
            <TabsTrigger value="keys" className="tm:flex-1">{t('terminal-ui.keychain.tab.keys')}</TabsTrigger>
            <TabsTrigger value="identities" className="tm:flex-1">{t('terminal-ui.keychain.tab.identities')}</TabsTrigger>
          </TabsList>
        </div>

        {error && (
          <div
            className="
              tm:mx-2 tm:mb-2 tm:rounded-md tm:border tm:border-red/40 tm:bg-red/10 tm:px-2 tm:py-1.5 tm:text-[11px]
              tm:text-red
            "
          >
            {error}
          </div>
        )}

        <TabsContent value="keys" className="tm:min-h-0 tm:flex-1 tm:overflow-auto tm:px-2 tm:pb-2">
          {keys.length === 0
            ? <EmptyHint text={t('terminal-ui.keychain.empty.keys')} />
            : (
              <ul className="tm:flex tm:flex-col tm:gap-1.5">
                {keys.map((key) => (
                  <KeychainRow
                    key={key.id}
                    icon={<KeyRound size={18} strokeWidth={1.6} />}
                    title={key.label}
                    subtitle={`${key.algorithm.toUpperCase()}${key.bits ? ` ${key.bits}` : ''} · ${key.publicKeyFingerprint ?? ''}`}
                    onEdit={() => dialogService.openEditKey(key)}
                    onDelete={() => deleteKey(key.id)}
                  />
                ))}
              </ul>
            )}
        </TabsContent>

        <TabsContent value="identities" className="tm:min-h-0 tm:flex-1 tm:overflow-auto tm:px-2 tm:pb-2">
          {identities.length === 0
            ? <EmptyHint text={t('terminal-ui.keychain.empty.identities')} />
            : (
              <ul className="tm:flex tm:flex-col tm:gap-1.5">
                {identities.map((identity) => (
                  <KeychainRow
                    key={identity.id}
                    icon={<UserRound size={18} strokeWidth={1.6} />}
                    title={identity.label}
                    subtitle={identity.username}
                    badge={identity.keyId ? 'key' : (identity.hasPassword ? 'password' : undefined)}
                    onEdit={() => dialogService.openEditIdentity(identity)}
                    onDelete={() => deleteIdentity(identity.id)}
                  />
                ))}
              </ul>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="tm:flex tm:flex-col tm:items-center tm:gap-2 tm:py-12 tm:text-center tm:text-grey-fg">
      <FileKey2 size={26} strokeWidth={1.4} />
      <span className="tm:px-2 tm:text-[12px]">{text}</span>
    </div>
  );
}

interface IKeychainRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  onEdit: () => void;
  onDelete: () => void;
}

function KeychainRow({ icon, title, subtitle, badge, onEdit, onDelete }: IKeychainRowProps) {
  return (
    <li
      className={cn(`
        tm:group
        tm:flex tm:items-center tm:gap-2.5 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-2.5
        tm:hover:bg-one-bg2
      `)}
    >
      <span
        className="
          tm:flex tm:size-9 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-lg tm:bg-blue tm:text-[#fff]
        "
      >
        {icon}
      </span>
      <div className="tm:min-w-0 tm:flex-1">
        <div className="tm:truncate tm:text-[13px] tm:font-semibold tm:text-white">{title}</div>
        <div className="tm:truncate tm:text-[11px] tm:text-grey-fg">{subtitle}</div>
      </div>
      {badge && <Badge variant="secondary" className="tm:text-[10px]">{badge}</Badge>}
      <div
        className="
          tm:hidden tm:items-center tm:gap-0.5
          tm:group-hover:flex
        "
      >
        <Button variant="ghost" size="icon-xs" onClick={onEdit}><Pencil size={13} /></Button>
        <Button variant="ghost" size="icon-xs" onClick={onDelete} className="tm:hover:bg-red/10 tm:hover:text-red"><Trash2 size={13} /></Button>
      </div>
    </li>
  );
}
