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

import type { IProviderGroup, ITerminalSuggestConfig } from '@termlnk/agent';
import type { CursorStyle, ILocalTerminalConfig, ILocalTerminalShellOption, IShellIntegrationConfig, ITerminalAppearanceConfig, LocalTerminalShell, TerminalRendererEngine } from '@termlnk/terminal';
import type { ReactElement } from 'react';
import { AGENT_PLUGIN_CONFIG_KEY, AGENT_TERMINAL_SUGGEST_CONFIG_SUB_KEY, DEFAULT_TERMINAL_SUGGEST_CONFIG } from '@termlnk/agent';
import { LocaleService, platform } from '@termlnk/core';
import { Card, CardContent, CardHeader, cn, Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useDependency, useObservable } from '@termlnk/design';
import { IConfigManagerService, IProviderConfigService } from '@termlnk/rpc-client';
import { createMissingShellOption, DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK, DEFAULT_CURSOR_BLINK, DEFAULT_CURSOR_STYLE, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_LETTER_SPACING, DEFAULT_PERSISTENCE_SCROLLBACK, DEFAULT_TERMINAL_RENDERER_ENGINE, getDefaultLocalTerminalConfig, IPTYService, normalizeLocalTerminalConfig, normalizeShellIntegrationConfig, resolveLegacyShellValue, SHELL_INTEGRATION_CONFIG_KEY, TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/terminal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TERMINAL_FONT_FAMILIES, PERSISTENCE_SCROLLBACK_MAX, PERSISTENCE_SCROLLBACK_MIN, TERMINAL_FONT_SIZE_MAX, TERMINAL_FONT_SIZE_MIN, TERMINAL_LETTER_SPACING_MAX, TERMINAL_LETTER_SPACING_MIN } from '../../../config/config';

interface IFontMetadata {
  family?: string;
}

type LocalFontQuery = () => Promise<IFontMetadata[]>;

function createDefaultTerminalSettings(): ITerminalAppearanceConfig {
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    letterSpacing: DEFAULT_LETTER_SPACING,
    cursorStyle: DEFAULT_CURSOR_STYLE,
    cursorBlink: DEFAULT_CURSOR_BLINK,
    rendererEngine: DEFAULT_TERMINAL_RENDERER_ENGINE,
    persistentSession: true,
    persistentSessionScrollback: DEFAULT_PERSISTENCE_SCROLLBACK,
    ctrlOrMetaOpenTerminalLink: DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK,
  };
}

function createDefaultLocalTerminalSettings(): ILocalTerminalConfig {
  return getDefaultLocalTerminalConfig(platform);
}

function normalizeFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return createDefaultTerminalSettings().fontSize;
  }
  return Math.min(TERMINAL_FONT_SIZE_MAX, Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)));
}

function normalizeLetterSpacing(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LETTER_SPACING;
  }
  return Math.min(TERMINAL_LETTER_SPACING_MAX, Math.max(TERMINAL_LETTER_SPACING_MIN, Math.round(value)));
}

function normalizePersistenceScrollback(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PERSISTENCE_SCROLLBACK;
  }
  return Math.min(PERSISTENCE_SCROLLBACK_MAX, Math.max(PERSISTENCE_SCROLLBACK_MIN, Math.round(value)));
}

function normalizeTerminalSettings(value: Partial<ITerminalAppearanceConfig> | null): ITerminalAppearanceConfig {
  const defaults = createDefaultTerminalSettings();
  if (!value) {
    return defaults;
  }

  return {
    fontFamily: typeof value.fontFamily === 'string' && value.fontFamily.length > 0
      ? value.fontFamily
      : defaults.fontFamily,
    fontSize: normalizeFontSize(Number(value.fontSize)),
    letterSpacing: normalizeLetterSpacing(Number(value.letterSpacing ?? defaults.letterSpacing)),
    cursorStyle: value.cursorStyle === 'bar' || value.cursorStyle === 'block' || value.cursorStyle === 'underline'
      ? value.cursorStyle
      : defaults.cursorStyle,
    cursorBlink: typeof value.cursorBlink === 'boolean'
      ? value.cursorBlink
      : defaults.cursorBlink,
    rendererEngine: value.rendererEngine === 'dom' || value.rendererEngine === 'webgl'
      ? value.rendererEngine
      : defaults.rendererEngine,
    persistentSession: typeof value.persistentSession === 'boolean'
      ? value.persistentSession
      : defaults.persistentSession,
    persistentSessionScrollback: normalizePersistenceScrollback(Number(value.persistentSessionScrollback)),
    ctrlOrMetaOpenTerminalLink: typeof value.ctrlOrMetaOpenTerminalLink === 'boolean'
      ? value.ctrlOrMetaOpenTerminalLink
      : defaults.ctrlOrMetaOpenTerminalLink,
  };
}

const DEFAULT_INLINE_SUGGEST_MODEL_SENTINEL = '__termlnk_inline_suggest_default__';

interface IInlineSuggestModelItem {
  value: string;
  label: string;
}

interface IInlineSuggestModelComboboxProps {
  value: string | null;
  onChange: (modelId: string | null) => void;
}

function compareInlineSuggestModelItems(a: IInlineSuggestModelItem, b: IInlineSuggestModelItem): boolean {
  return a.value === b.value;
}

function InlineSuggestModelCombobox(props: IInlineSuggestModelComboboxProps): ReactElement {
  const { value, onChange } = props;
  const localeService = useDependency(LocaleService);
  const providerConfigService = useDependency(IProviderConfigService);
  const providers = useObservable(providerConfigService.providers$, [] as IProviderGroup[]);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const defaultLabel = localeService.t('settings-ui.terminal.inline-suggest-model-default');

  const items = useMemo<IInlineSuggestModelItem[]>(() => {
    const result: IInlineSuggestModelItem[] = [
      { value: DEFAULT_INLINE_SUGGEST_MODEL_SENTINEL, label: defaultLabel },
    ];

    for (const provider of providers) {
      if (!provider.enabled) {
        continue;
      }
      for (const model of provider.models) {
        if (!model.enabled) {
          continue;
        }
        result.push({
          value: model.id,
          label: `${provider.name} · ${model.name}`,
        });
      }
    }

    // Surface stale ids as raw entries so a removed/disabled selection does
    // not silently revert to "use default" on next render.
    if (value && !result.some((item) => item.value === value)) {
      result.push({ value, label: value });
    }

    return result;
  }, [providers, defaultLabel, value]);

  const selectedItem = useMemo<IInlineSuggestModelItem | null>(() => {
    const lookupValue = value ?? DEFAULT_INLINE_SUGGEST_MODEL_SENTINEL;
    return items.find((item) => item.value === lookupValue) ?? null;
  }, [items, value]);

  const handleValueChange = useCallback((next: IInlineSuggestModelItem | null) => {
    if (!next || next.value === DEFAULT_INLINE_SUGGEST_MODEL_SENTINEL) {
      onChange(null);
      return;
    }
    onChange(next.value);
  }, [onChange]);

  return (
    <div ref={anchorRef} className="tm:relative tm:w-full">
      <Combobox
        items={items}
        value={selectedItem}
        onValueChange={handleValueChange}
        isItemEqualToValue={compareInlineSuggestModelItems}
      >
        <ComboboxInput
          className="tm:h-9 tm:w-full"
          placeholder={defaultLabel}
        />
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>
            {localeService.t('settings-ui.terminal.inline-suggest-model-empty')}
          </ComboboxEmpty>
          <ComboboxList className="tm:max-h-72">
            {(item: IInlineSuggestModelItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

export function TerminalTab(): ReactElement {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);
  const ptyService = useDependency(IPTYService);

  const [fontFamilies, setFontFamilies] = useState<string[]>(DEFAULT_TERMINAL_FONT_FAMILIES);
  const [availableLocalTerminalShellOptions, setAvailableLocalTerminalShellOptions] = useState<ILocalTerminalShellOption[]>([]);
  const [localTerminalSettings, setLocalTerminalSettings] = useState<ILocalTerminalConfig>(
    createDefaultLocalTerminalSettings
  );
  const [terminalSettings, setTerminalSettings] = useState<ITerminalAppearanceConfig>(
    createDefaultTerminalSettings
  );
  const [shellIntegrationConfig, setShellIntegrationConfig] = useState<IShellIntegrationConfig>(
    () => normalizeShellIntegrationConfig(null)
  );
  const [suggestConfig, setSuggestConfig] = useState<ITerminalSuggestConfig>(
    () => ({ ...DEFAULT_TERMINAL_SUGGEST_CONFIG })
  );
  const fontComboboxAnchorRef = useRef<HTMLDivElement | null>(null);

  const resolvedFontFamilies = useMemo(() => {
    const merged = [
      ...DEFAULT_TERMINAL_FONT_FAMILIES,
      ...fontFamilies,
      terminalSettings.fontFamily,
    ];
    const sorted = [...new Set(merged.filter((item) => item.length > 0 && item !== DEFAULT_FONT_FAMILY))]
      .sort((a, b) => a.localeCompare(b));
    return [DEFAULT_FONT_FAMILY, ...sorted];
  }, [fontFamilies, terminalSettings.fontFamily]);

  const localTerminalShellOptions = useMemo(() => {
    const options: ILocalTerminalShellOption[] = [
      {
        value: 'system',
        label: localeService.t('settings-ui.terminal.default-shell-system'),
      },
      ...availableLocalTerminalShellOptions,
    ];

    if (!options.some((option) => option.value === localTerminalSettings.defaultShell)) {
      options.push(createMissingShellOption(
        localTerminalSettings.defaultShell,
        localeService.t('settings-ui.terminal.default-shell-system'),
        localeService.t('settings-ui.terminal.default-shell-powershell'),
        localeService.t('settings-ui.terminal.default-shell-command-prompt')
      ));
    }

    return options;
  }, [availableLocalTerminalShellOptions, localTerminalSettings.defaultShell, localeService]);

  const updateLocalTerminalSettings = useCallback(
    (updates: Partial<ILocalTerminalConfig>) => {
      setLocalTerminalSettings((prev) => {
        const next = normalizeLocalTerminalConfig({ ...prev, ...updates }, platform);
        void configManagerService.setField(TERMINAL_PLUGIN_CONFIG_KEY, 'localTerminal', next).catch(() => { });
        return next;
      });
    },
    [configManagerService]
  );

  const updateTerminalSettings = useCallback(
    (updates: Partial<ITerminalAppearanceConfig>) => {
      setTerminalSettings((prev) => {
        const next = normalizeTerminalSettings({ ...prev, ...updates });
        void configManagerService.setField(TERMINAL_PLUGIN_CONFIG_KEY, 'appearance', next).catch(() => { });
        return next;
      });
    },
    [configManagerService]
  );

  const updateShellIntegrationSsh = useCallback(
    (patch: Partial<IShellIntegrationConfig['ssh']>) => {
      setShellIntegrationConfig((prev) => {
        const next = normalizeShellIntegrationConfig({
          ...prev,
          ssh: { ...prev.ssh, ...patch },
        });
        void configManagerService.set(SHELL_INTEGRATION_CONFIG_KEY, next).catch(() => { });
        return next;
      });
    },
    [configManagerService]
  );

  const updateSuggestConfig = useCallback(
    (patch: Partial<ITerminalSuggestConfig>) => {
      setSuggestConfig((prev) => {
        const next: ITerminalSuggestConfig = { ...prev, ...patch };
        void configManagerService
          .setField(AGENT_PLUGIN_CONFIG_KEY, AGENT_TERMINAL_SUGGEST_CONFIG_SUB_KEY, next)
          .catch(() => { });
        return next;
      });
    },
    [configManagerService]
  );

  useEffect(() => {
    let active = true;

    const loadLocalTerminalSettings = async () => {
      try {
        const stored = await configManagerService.getField<ILocalTerminalConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'localTerminal');
        if (!active) {
          return;
        }
        setLocalTerminalSettings(normalizeLocalTerminalConfig(stored, platform));
      } catch {
        if (active) {
          setLocalTerminalSettings(createDefaultLocalTerminalSettings());
        }
      }
    };

    loadLocalTerminalSettings();

    return () => {
      active = false;
    };
  }, [configManagerService]);

  useEffect(() => {
    let active = true;

    const loadLocalTerminalShellOptions = async () => {
      try {
        const options = await ptyService.getLocalTerminalShellOptions();
        if (!active) return;
        setAvailableLocalTerminalShellOptions(options);
      } catch {
        if (active) {
          setAvailableLocalTerminalShellOptions([]);
        }
      }
    };

    loadLocalTerminalShellOptions();

    return () => {
      active = false;
    };
  }, [ptyService]);

  useEffect(() => {
    let active = true;

    const loadShellIntegration = async () => {
      try {
        const stored = await configManagerService.get<Partial<IShellIntegrationConfig>>(SHELL_INTEGRATION_CONFIG_KEY);
        if (!active) {
          return;
        }
        setShellIntegrationConfig(normalizeShellIntegrationConfig(stored));
      } catch {
        if (active) {
          setShellIntegrationConfig(normalizeShellIntegrationConfig(null));
        }
      }
    };

    loadShellIntegration();

    return () => {
      active = false;
    };
  }, [configManagerService]);

  useEffect(() => {
    let active = true;

    const loadSuggestConfig = async () => {
      try {
        const stored = await configManagerService.getField<Partial<ITerminalSuggestConfig>>(
          AGENT_PLUGIN_CONFIG_KEY,
          AGENT_TERMINAL_SUGGEST_CONFIG_SUB_KEY
        );
        if (!active) {
          return;
        }
        setSuggestConfig({
          ...DEFAULT_TERMINAL_SUGGEST_CONFIG,
          ...(stored ?? {}),
        });
      } catch {
        if (active) {
          setSuggestConfig({ ...DEFAULT_TERMINAL_SUGGEST_CONFIG });
        }
      }
    };

    loadSuggestConfig();

    return () => {
      active = false;
    };
  }, [configManagerService]);

  const legacyMigrationDoneRef = useRef(false);

  useEffect(() => {
    if (legacyMigrationDoneRef.current || availableLocalTerminalShellOptions.length === 0) {
      return;
    }

    const migratedShellValue = resolveLegacyShellValue(
      localTerminalSettings.defaultShell,
      availableLocalTerminalShellOptions
    );

    if (!migratedShellValue || migratedShellValue === localTerminalSettings.defaultShell) {
      legacyMigrationDoneRef.current = true;
      return;
    }

    legacyMigrationDoneRef.current = true;
    updateLocalTerminalSettings({ defaultShell: migratedShellValue });
  }, [availableLocalTerminalShellOptions, localTerminalSettings.defaultShell, updateLocalTerminalSettings]);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const stored = await configManagerService.getField<ITerminalAppearanceConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'appearance');
        if (!active) {
          return;
        }
        setTerminalSettings(normalizeTerminalSettings(stored));
      } catch {
        if (active) {
          setTerminalSettings(createDefaultTerminalSettings());
        }
      }
    };

    loadSettings();
    return () => {
      active = false;
    };
  }, [configManagerService]);

  useEffect(() => {
    let active = true;

    const loadFonts = async () => {
      const queryLocalFonts = (window as Window & { queryLocalFonts?: LocalFontQuery }).queryLocalFonts;
      if (!queryLocalFonts) {
        return;
      }

      try {
        const fonts = await queryLocalFonts();
        if (!active) return;

        const families = fonts
          .map((font) => font.family)
          .filter((family): family is string => typeof family === 'string' && family.length > 0);

        if (families.length === 0) {
          setFontFamilies(DEFAULT_TERMINAL_FONT_FAMILIES);
          return;
        }

        setFontFamilies([...new Set(families)]);
      } catch {
        if (active) {
          setFontFamilies(DEFAULT_TERMINAL_FONT_FAMILIES);
        }
      }
    };

    loadFonts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <FieldGroup className="tm:gap-5">
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.terminal.local-terminal-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-default-shell"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.default-shell')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.default-shell-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Select
                  value={localTerminalSettings.defaultShell}
                  onValueChange={(value: LocalTerminalShell) => updateLocalTerminalSettings({ defaultShell: value })}
                >
                  <SelectTrigger id="terminal-default-shell" className={cn('tm:w-48')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localTerminalShellOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.terminal.settings-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-font-family"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.font-family')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.font-family-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <div
                  ref={fontComboboxAnchorRef}
                  className={cn('tm:relative tm:w-88 tm:max-w-full')}
                >
                  <Combobox
                    value={terminalSettings.fontFamily}
                    items={resolvedFontFamilies}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      updateTerminalSettings({ fontFamily: value });
                    }}
                  >
                    <ComboboxInput
                      id="terminal-font-family"
                      className="tm:h-10 tm:w-full"
                      placeholder={localeService.t('settings-ui.terminal.font-family-placeholder')}
                    />
                    <ComboboxContent
                      anchor={fontComboboxAnchorRef}
                    >
                      <ComboboxEmpty>
                        {localeService.t('settings-ui.terminal.font-family-empty')}
                      </ComboboxEmpty>
                      <ComboboxList className="tm:max-h-72">
                        {(family: string) => (
                          <ComboboxItem key={family} value={family}>
                            {family === DEFAULT_FONT_FAMILY
                              ? localeService.t('settings-ui.terminal.font-family-default')
                              : family}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </FieldContent>
            </Field>

            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-font-size"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.font-size')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.font-size-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Input
                  id="terminal-font-size"
                  className={cn('tm:h-10 tm:w-23.5 tm:px-3 tm:text-sm')}
                  type="number"
                  min={TERMINAL_FONT_SIZE_MIN}
                  max={TERMINAL_FONT_SIZE_MAX}
                  value={terminalSettings.fontSize}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    updateTerminalSettings({
                      fontSize: Number.isNaN(next) ? createDefaultTerminalSettings().fontSize : next,
                    });
                  }}
                />
              </FieldContent>
            </Field>

            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-letter-spacing"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.letter-spacing')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.letter-spacing-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Input
                  id="terminal-letter-spacing"
                  className={cn('tm:h-10 tm:w-23.5 tm:px-3 tm:text-sm')}
                  type="number"
                  min={TERMINAL_LETTER_SPACING_MIN}
                  max={TERMINAL_LETTER_SPACING_MAX}
                  value={terminalSettings.letterSpacing}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    updateTerminalSettings({
                      letterSpacing: Number.isNaN(next) ? DEFAULT_LETTER_SPACING : next,
                    });
                  }}
                />
              </FieldContent>
            </Field>

            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-cursor-style"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.cursor-style')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.cursor-style-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Select
                  value={terminalSettings.cursorStyle}
                  onValueChange={(value: CursorStyle) => updateTerminalSettings({ cursorStyle: value })}
                >
                  <SelectTrigger id="terminal-cursor-style" className={cn('tm:w-23.5')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">
                      {localeService.t('settings-ui.terminal.cursor-style-bar')}
                    </SelectItem>
                    <SelectItem value="block">
                      {localeService.t('settings-ui.terminal.cursor-style-block')}
                    </SelectItem>
                    <SelectItem value="underline">
                      {localeService.t('settings-ui.terminal.cursor-style-underline')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.cursor-blink')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.cursor-blink-description')}
                </p>
              </div>
              <Switch
                checked={terminalSettings.cursorBlink}
                onCheckedChange={(checked) => updateTerminalSettings({ cursorBlink: checked })}
              />
            </div>

            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel
                htmlFor="terminal-renderer-engine"
                className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
              >
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.terminal.renderer-engine')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.renderer-engine-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Select
                  value={terminalSettings.rendererEngine}
                  onValueChange={(value: string) => updateTerminalSettings({ rendererEngine: value as TerminalRendererEngine })}
                >
                  <SelectTrigger id="terminal-renderer-engine" className={cn('tm:w-23.5')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dom">
                      {localeService.t('settings-ui.terminal.renderer-engine-dom')}
                    </SelectItem>
                    <SelectItem value="webgl">
                      {localeService.t('settings-ui.terminal.renderer-engine-webgl')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.ctrl-or-meta-open-link')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.ctrl-or-meta-open-link-description')}
                </p>
              </div>
              <Switch
                checked={terminalSettings.ctrlOrMetaOpenTerminalLink}
                onCheckedChange={(checked) => updateTerminalSettings({ ctrlOrMetaOpenTerminalLink: checked })}
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.terminal.shell-integration-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.shell-integration-auto-inject')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.shell-integration-auto-inject-description')}
                </p>
              </div>
              <Switch
                checked={shellIntegrationConfig.ssh.autoInject}
                onCheckedChange={(checked) => updateShellIntegrationSsh({ autoInject: checked })}
              />
            </div>

            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.shell-integration-heuristic')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.shell-integration-heuristic-description')}
                </p>
              </div>
              <Switch
                checked={shellIntegrationConfig.ssh.fallbackHeuristic}
                onCheckedChange={(checked) => updateShellIntegrationSsh({ fallbackHeuristic: checked })}
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.terminal.inline-suggest-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.inline-suggest-enabled')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.inline-suggest-enabled-description')}
                </p>
              </div>
              <Switch
                checked={suggestConfig.enabled}
                onCheckedChange={(checked) => updateSuggestConfig({ enabled: checked })}
              />
            </div>

            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.inline-suggest-nl')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.inline-suggest-nl-description')}
                </p>
              </div>
              <Switch
                checked={suggestConfig.enabled && suggestConfig.naturalLanguageEnabled}
                disabled={!suggestConfig.enabled}
                onCheckedChange={(checked) => updateSuggestConfig({ naturalLanguageEnabled: checked })}
              />
            </div>

            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.inline-suggest-error')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.inline-suggest-error-description')}
                </p>
              </div>
              <Switch
                checked={suggestConfig.enabled && suggestConfig.errorAutoSuggest}
                disabled={!suggestConfig.enabled}
                onCheckedChange={(checked) => updateSuggestConfig({ errorAutoSuggest: checked })}
              />
            </div>

            {suggestConfig.enabled && (suggestConfig.naturalLanguageEnabled || suggestConfig.errorAutoSuggest) && (
              <Field orientation="horizontal" className="tm:items-start">
                <FieldLabel
                  className={cn('tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white')}
                >
                  <span className="tm:text-sm tm:font-normal">
                    {localeService.t('settings-ui.terminal.inline-suggest-model')}
                  </span>
                  <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                    {localeService.t('settings-ui.terminal.inline-suggest-model-description')}
                  </span>
                </FieldLabel>
                <FieldContent className="tm:flex-none tm:items-end">
                  <div className={cn('tm:w-60 tm:max-w-full')}>
                    <InlineSuggestModelCombobox
                      value={suggestConfig.suggestModelId ?? null}
                      onChange={(modelId) => updateSuggestConfig({ suggestModelId: modelId ?? undefined })}
                    />
                  </div>
                </FieldContent>
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.terminal.history-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <div className="tm:min-w-0">
                <p className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.persistence')}
                </p>
                <p className="tm:mt-1 tm:text-xs tm:text-grey-fg">
                  {localeService.t('settings-ui.terminal.persistence-description')}
                </p>
              </div>
              <Switch
                checked={terminalSettings.persistentSession}
                onCheckedChange={(checked) => updateTerminalSettings({ persistentSession: checked })}
              />
            </div>

            {terminalSettings.persistentSession && (
              <Field>
                <FieldLabel className="tm:text-sm tm:font-normal tm:text-white">
                  {localeService.t('settings-ui.terminal.persistence-scrollback')}
                </FieldLabel>
                <FieldContent>
                  <div className="tm:flex tm:items-center tm:gap-2">
                    <Input
                      className={cn('tm:h-10 tm:w-36 tm:px-3 tm:text-sm')}
                      type="number"
                      min={PERSISTENCE_SCROLLBACK_MIN}
                      max={PERSISTENCE_SCROLLBACK_MAX}
                      value={terminalSettings.persistentSessionScrollback}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        updateTerminalSettings({
                          persistentSessionScrollback: Number.isNaN(next) ? DEFAULT_PERSISTENCE_SCROLLBACK : next,
                        });
                      }}
                    />
                  </div>
                  <FieldDescription className="tm:text-xs">
                    {localeService.t('settings-ui.terminal.persistence-scrollback-description')}
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
