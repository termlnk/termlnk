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

import type { ISnippetPackage } from '@termlnk/snippet';
import type { HostTree } from '@termlnk/terminal';
import type { FC } from 'react';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useDependency, useObservable } from '@termlnk/design';
import { IHostManagerService } from '@termlnk/rpc-client';
import { ISnippetService } from '@termlnk/snippet';
import { HostType } from '@termlnk/terminal';
import { GripVertical, PlusIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ISnippetDialogService } from '../services/snippet-dialog.service';

export const SNIPPET_DIALOG_COMPONENT_NAME = 'snippet-ui.component.snippet-dialog';

export interface IHostOption {
  id: string;
  label: string;
  addr: string;
  port: number;
}

function flattenHosts(tree: HostTree[]): IHostOption[] {
  const out: IHostOption[] = [];
  const walk = (nodes: HostTree[]): void => {
    for (const node of nodes) {
      if (node.type === HostType.HOST) {
        out.push({
          id: node.id,
          label: node.label,
          addr: (node as { addr?: string }).addr ?? '',
          port: (node as { port?: number }).port ?? 22,
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(tree);
  return out;
}

export const SnippetDialog: FC = () => {
  const snippetService = useDependency(ISnippetService);
  const snippetDialog = useDependency(ISnippetDialogService);
  const hostManager = useDependency(IHostManagerService);
  const localeService = useDependency(LocaleService);
  const state = useObservable(snippetDialog.state$, snippetDialog.getState());

  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [pid, setPid] = useState<string | undefined>(undefined);
  const [targetHostIds, setTargetHostIds] = useState<string[]>([]);
  const [allHosts, setAllHosts] = useState<IHostOption[]>([]);
  const [allPackages, setAllPackages] = useState<ISnippetPackage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  useEffect(() => {
    void hostManager.tree().then((trees) => {
      setAllHosts(flattenHosts(trees));
    });
    void snippetService.getAllPackages().then(setAllPackages);
  }, [hostManager, snippetService]);

  useEffect(() => {
    if (!state.open) {
      return;
    }
    if (state.mode === 'edit' && state.snippetId) {
      void snippetService.getById(state.snippetId).then((s) => {
        if (s) {
          setLabel(s.label);
          setContent(s.content);
          setDescription(s.description ?? '');
          setPid(s.pid === 'root' ? undefined : s.pid);
          setTargetHostIds(s.targetHostIds ?? []);
        }
      });
    } else {
      setLabel('');
      setContent('');
      setDescription('');
      setPid(undefined);
      setTargetHostIds([]);
    }
    setPickerOpen(false);
  }, [state.open, state.mode, state.snippetId, snippetService]);

  const handleSave = async (): Promise<void> => {
    if (!label.trim()) {
      return;
    }
    setBusy(true);
    try {
      const data = {
        label,
        content,
        description: description || undefined,
        pid: pid ?? 'root',
        targetHostIds: targetHostIds.length > 0 ? targetHostIds : undefined,
      };
      if (state.mode === 'edit' && state.snippetId) {
        await snippetService.update(state.snippetId, data);
      } else {
        await snippetService.create({ ...data, sort: 0, favorite: false });
      }
      snippetDialog.close();
    } finally {
      setBusy(false);
    }
  };

  const removeTarget = (hostId: string): void => {
    setTargetHostIds((prev) => prev.filter((id) => id !== hostId));
  };

  const handlePickerSelect = (hostId: string): void => {
    if (!targetHostIds.includes(hostId)) {
      setTargetHostIds((prev) => [...prev, hostId]);
    }
    setPickerOpen(false);
  };

  const targetHosts = useMemo(
    () => targetHostIds.map((id) => allHosts.find((h) => h.id === id)).filter(Boolean) as IHostOption[],
    [allHosts, targetHostIds]
  );

  const availableHosts = useMemo(
    () => allHosts.filter((h) => !targetHostIds.includes(h.id)),
    [allHosts, targetHostIds]
  );

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4 tm:p-4')}>
      {/* Label */}
      <div className="tm:flex tm:flex-col tm:gap-1.5">
        <label className="tm:text-xs tm:text-grey-fg">{t('snippet-ui.editor.label')}</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('snippet-ui.editor.labelPlaceholder')}
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="tm:flex tm:flex-col tm:gap-1.5">
        <label className="tm:text-xs tm:text-grey-fg">{t('snippet-ui.editor.description')}</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('snippet-ui.editor.descriptionPlaceholder')}
        />
      </div>

      {/* Package */}
      <div className="tm:flex tm:flex-col tm:gap-1.5">
        <label className="tm:text-xs tm:text-grey-fg">{t('snippet-ui.editor.package')}</label>
        <Select value={pid ?? '__none__'} onValueChange={(v) => setPid(v === '__none__' ? undefined : v)}>
          <SelectTrigger className="tm:w-full">
            <SelectValue placeholder={t('snippet-ui.editor.noPackage')} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="__none__">{t('snippet-ui.editor.noPackage')}</SelectItem>
            {allPackages.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id}>{pkg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Script */}
      <div className="tm:flex tm:flex-col tm:gap-1.5">
        <label className="tm:text-xs tm:text-grey-fg">{t('snippet-ui.editor.script')}</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('snippet-ui.editor.scriptPlaceholder')}
          rows={6}
          className="tm:font-mono tm:text-xs"
        />
      </div>

      {/* Targets */}
      <div className="tm:flex tm:flex-col tm:gap-2">
        <span className="tm:text-xs tm:text-grey-fg">{t('snippet-ui.editor.targets')}</span>

        {/* Selected targets */}
        {targetHosts.length > 0 && (
          <div className="tm:flex tm:flex-col tm:gap-1">
            {targetHosts.map((host) => (
              <div
                key={host.id}
                className={cn(`
                  tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-1.5
                `)}
              >
                <GripVertical className="tm:size-3.5 tm:shrink-0 tm:text-grey" />
                <span className="tm:flex-1 tm:truncate tm:text-xs tm:text-white">{host.label}</span>
                <span className="tm:text-xs tm:text-grey-fg">
                  {host.addr}
                  :
                  {host.port}
                </span>
                <button
                  type="button"
                  className={cn(`
                    tm:rounded-sm tm:p-0.5 tm:text-grey
                    tm:hover:text-light-grey
                  `)}
                  onClick={() => removeTarget(host.id)}
                >
                  <X className="tm:size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add target — Popover + Command picker */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild disabled={availableHosts.length === 0}>
            <button
              type="button"
              disabled={availableHosts.length === 0}
              className={cn(
                `
                  tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-dashed tm:border-one-bg3
                  tm:bg-transparent tm:px-2 tm:py-1.5 tm:text-xs tm:text-white tm:transition-colors
                  tm:hover:border-blue tm:hover:text-blue
                  tm:focus-visible:border-blue tm:focus-visible:text-blue tm:focus-visible:outline-hidden
                `,
                {
                  'tm:cursor-not-allowed tm:opacity-40 tm:hover:border-one-bg3 tm:hover:text-white': availableHosts.length === 0,
                  'tm:border-blue tm:text-blue': pickerOpen,
                }
              )}
            >
              <PlusIcon className="tm:size-3.5" />
              <span className="tm:flex-1 tm:text-left">{t('snippet-ui.editor.addTargets')}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="tm:w-(--radix-popover-trigger-width) tm:max-w-md tm:min-w-65 tm:border-line tm:bg-black tm:p-0"
          >
            <Command>
              <CommandInput placeholder={t('snippet-ui.editor.searchHost')} />
              <CommandList>
                <CommandEmpty>{t('snippet-ui.editor.noHosts')}</CommandEmpty>
                <CommandGroup>
                  {availableHosts.map((host) => (
                    <CommandItem
                      key={host.id}
                      value={`${host.label} ${host.addr} ${host.port}`}
                      onSelect={() => handlePickerSelect(host.id)}
                    >
                      <span className="tm:flex-1 tm:truncate">{host.label}</span>
                      <span className="tm:ml-2 tm:text-xs tm:text-grey-fg2">
                        {host.addr}
                        :
                        {host.port}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Footer */}
      <div className="tm:flex tm:justify-end tm:gap-2">
        <Button variant="outline" size="sm" onClick={() => snippetDialog.close()}>
          {t('snippet-ui.editor.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={busy || !label.trim()}>
          {state.mode === 'edit' ? t('snippet-ui.editor.save') : t('snippet-ui.editor.create')}
        </Button>
      </div>
    </div>
  );
};
