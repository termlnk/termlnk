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

import type { IHostSettings } from '@termlnk/terminal';
import type { HostFormItem } from '../../../models/host-dialog.state';
import { LocaleService } from '@termlnk/core';
import { cn, Field, FieldContent, FieldError, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, Switch, Textarea, useDependency } from '@termlnk/design';
import { ENCODING_GROUPS } from '@termlnk/terminal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FONT_FAMILIES, DEFAULT_TERM_TYPES } from '../../../config/config';
import { DEFAULT_HOST_SETTINGS } from '../../../models/host-dialog.state';

export interface IAdvancedTabProps {
  data: HostFormItem;
  onChange: (data: Partial<HostFormItem>) => void;
  getError: (path: string) => string | undefined;
}

const compactInputCls = 'tm:h-8 tm:px-2 tm:py-1 tm:text-xs';
const compactSelectCls = 'tm:h-8 tm:w-32 tm:px-2 tm:text-xs';
const horizontalLabelCls = 'tm:w-28 tm:shrink-0 tm:flex-none tm:text-xs tm:h-8 tm:leading-8';

interface IFontMetadata {
  family?: string;
}

type LocalFontQuery = () => Promise<IFontMetadata[]>;

export function AdvancedTab(props: IAdvancedTabProps) {
  const { data, onChange, getError } = props;
  const localeService = useDependency(LocaleService);

  const settings = data.settings ?? DEFAULT_HOST_SETTINGS;

  const updateSettings = (updates: Partial<IHostSettings>) => {
    onChange({
      settings: { ...settings, ...updates },
    });
  };

  const [fontSizeInput, setFontSizeInput] = useState<string>(String(settings.fontSize ?? 12));
  const fontSizeRef = useRef(settings.fontSize);

  // Sync local input when external value changes (e.g. reset)
  if (fontSizeRef.current !== settings.fontSize) {
    fontSizeRef.current = settings.fontSize;
    setFontSizeInput(String(settings.fontSize ?? 12));
  }

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setFontSizeInput(raw);
    const parsed = Number.parseInt(raw);
    if (!Number.isNaN(parsed)) {
      updateSettings({ fontSize: parsed });
    }
  };

  const handleFontSizeBlur = () => {
    const parsed = Number.parseInt(fontSizeInput);
    if (Number.isNaN(parsed)) {
      const fallback = settings.fontSize ?? 12;
      setFontSizeInput(String(fallback));
      updateSettings({ fontSize: fallback });
      return;
    }
    const clamped = Math.min(24, Math.max(8, parsed));
    setFontSizeInput(String(clamped));
    updateSettings({ fontSize: clamped });
  };

  const [fontFamilies, setFontFamilies] = useState<string[]>(DEFAULT_FONT_FAMILIES);

  const resolvedFontFamilies = useMemo(() => {
    const candidates = fontFamilies.length > 0 ? fontFamilies : DEFAULT_FONT_FAMILIES;
    return [...new Set(candidates)].sort((a, b) => a.localeCompare(b));
  }, [fontFamilies]);

  useEffect(() => {
    let active = true;

    const loadFonts = async () => {
      const queryLocalFonts = (window as Window & { queryLocalFonts?: LocalFontQuery }).queryLocalFonts;
      if (!queryLocalFonts) {
        return;
      }

      try {
        const fonts = await queryLocalFonts();
        const families = fonts
          .map((font) => font.family)
          .filter((family): family is string => typeof family === 'string' && family.length > 0);

        if (!active) return;

        if (families.length === 0) {
          setFontFamilies(DEFAULT_FONT_FAMILIES);
          return;
        }

        setFontFamilies([...new Set(families)]);
      } catch {
        if (active) {
          setFontFamilies(DEFAULT_FONT_FAMILIES);
        }
      }
    };

    loadFonts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <FieldGroup className="tm:gap-3">
      <Field orientation="horizontal" className="tm:items-center!">
        <FieldLabel htmlFor="advanced-x11forward" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.x11Forward')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Switch
            id="advanced-x11forward"
            checked={settings.x11Forward}
            onCheckedChange={(checked) => updateSettings({ x11Forward: checked })}
          />
        </FieldContent>
      </Field>

      <Field orientation="horizontal" data-invalid={!!getError('settings.connectTimeout')}>
        <FieldLabel htmlFor="advanced-timeout" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.timeout')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Input
            id="advanced-timeout"
            className={cn(compactInputCls, 'tm:w-32')}
            type="number"
            value={settings.connectTimeout}
            onChange={(e) => updateSettings({ connectTimeout: Number.parseInt(e.target.value) })}
            placeholder="30000"
          />
          <FieldError>{getError('settings.connectTimeout')}</FieldError>
        </FieldContent>
      </Field>

      <Field orientation="horizontal" data-invalid={!!getError('settings.connectHeartbeat')}>
        <FieldLabel htmlFor="advanced-heartbeat" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.heartbeat')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Input
            id="advanced-heartbeat"
            className={cn(compactInputCls, 'tm:w-32')}
            type="number"
            value={settings.connectHeartbeat}
            onChange={(e) => updateSettings({ connectHeartbeat: Number.parseInt(e.target.value) })}
            placeholder="10000"
          />
          <FieldError>{getError('settings.connectHeartbeat')}</FieldError>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="advanced-termtype" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.termType')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Select
            value={settings.termType}
            onValueChange={(v) => updateSettings({ termType: v })}
          >
            <SelectTrigger id="advanced-termtype" className={compactSelectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_TERM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="advanced-encode" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.encode')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Select
            value={settings.encode}
            onValueChange={(v) => updateSettings({ encode: v })}
          >
            <SelectTrigger id="advanced-encode" className={compactSelectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENCODING_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="advanced-font" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.fontFamily')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Select
            value={settings.fontFamily || '__default__'}
            onValueChange={(v) => updateSettings({ fontFamily: v === '__default__' ? '' : v })}
          >
            <SelectTrigger id="advanced-font" className={compactSelectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{localeService.t('terminal-ui.host-dialog.advanced.fontDefault')}</SelectItem>
              {resolvedFontFamilies.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field orientation="horizontal" data-invalid={!!getError('settings.fontSize')}>
        <FieldLabel htmlFor="advanced-fontsize" className={horizontalLabelCls}>
          {localeService.t('terminal-ui.host-dialog.advanced.fontSize')}
        </FieldLabel>
        <FieldContent className="tm:items-end">
          <Input
            id="advanced-fontsize"
            className={cn(compactInputCls, 'tm:w-32')}
            type="number"
            min={8}
            max={24}
            value={fontSizeInput}
            onChange={handleFontSizeChange}
            onBlur={handleFontSizeBlur}
            placeholder="12"
          />
          <FieldError>{getError('settings.fontSize')}</FieldError>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="advanced-runscript" className="tm:text-xs">
          {localeService.t('terminal-ui.host-dialog.advanced.runScript')}
        </FieldLabel>
        <FieldContent>
          <Textarea
            id="advanced-runscript"
            className="tm:min-h-12 tm:px-2 tm:py-1 tm:text-xs"
            value={settings.runScript ?? ''}
            onChange={(e) => updateSettings({ runScript: e.target.value })}
            rows={3}
            placeholder={localeService.t('terminal-ui.host-dialog.advanced.runScriptPlaceholder')}
          />
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
