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

import type { IWindowTransparencyConfig } from '@termlnk/terminal';
import type { IUIConfig } from '@termlnk/ui';
import { LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, Field, FieldContent, FieldGroup, FieldLabel, Input, Slider, Switch, useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { DEFAULT_WINDOW_TRANSPARENCY_OPACITY, TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/terminal';
import { DEFAULT_UI_FONT_FAMILY, DEFAULT_UI_FONT_SIZE, injectUIFontToDOM, UI_PLUGIN_CONFIG_KEY } from '@termlnk/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const UI_FONT_SIZE_MIN = 10;
const UI_FONT_SIZE_MAX = 32;

const DEFAULT_UI_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'Segoe UI',
  'Noto Sans',
  'Open Sans',
  'Lato',
  'Source Sans 3',
  'PingFang SC',
  'Microsoft YaHei',
];

interface IFontMetadata {
  family?: string;
}

type LocalFontQuery = () => Promise<IFontMetadata[]>;

interface IInterfaceSettings {
  fontFamily: string;
  fontSize: number;
}

function createDefaultSettings(): IInterfaceSettings {
  return {
    fontFamily: DEFAULT_UI_FONT_FAMILY,
    fontSize: DEFAULT_UI_FONT_SIZE,
  };
}

function normalizeFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_UI_FONT_SIZE;
  }
  return Math.min(UI_FONT_SIZE_MAX, Math.max(UI_FONT_SIZE_MIN, Math.round(value)));
}

function normalizeSettings(fontFamily?: string, fontSize?: number): IInterfaceSettings {
  return {
    fontFamily: typeof fontFamily === 'string' ? fontFamily : DEFAULT_UI_FONT_FAMILY,
    fontSize: normalizeFontSize(Number(fontSize ?? DEFAULT_UI_FONT_SIZE)),
  };
}

const inputCls = 'tm:h-10 tm:px-3 tm:text-sm';
const compactControlWidthCls = 'tm:w-[94px]';
const fontFamilyControlWidthCls = 'tm:w-[22rem] tm:max-w-full';
const horizontalFieldLabelCls = 'tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white';

const OPACITY_MIN = 30;
const OPACITY_MAX = 100;

function normalizeTransparencyConfig(value: Partial<IWindowTransparencyConfig> | null): IWindowTransparencyConfig {
  if (!value) {
    return { enabled: false, opacity: DEFAULT_WINDOW_TRANSPARENCY_OPACITY };
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    opacity: typeof value.opacity === 'number' && value.opacity >= 0.3 && value.opacity <= 1
      ? value.opacity
      : DEFAULT_WINDOW_TRANSPARENCY_OPACITY,
  };
}

export function InterfaceTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [fontFamilies, setFontFamilies] = useState<string[]>(DEFAULT_UI_FONT_FAMILIES);
  const [settings, setSettings] = useState<IInterfaceSettings>(createDefaultSettings);
  const [transparencyConfig, setTransparencyConfig] = useState<IWindowTransparencyConfig>(
    () => ({ enabled: false, opacity: DEFAULT_WINDOW_TRANSPARENCY_OPACITY })
  );
  const fontComboboxAnchorRef = useRef<HTMLDivElement | null>(null);

  const resolvedFontFamilies = useMemo(() => {
    const merged = [...DEFAULT_UI_FONT_FAMILIES, ...fontFamilies, settings.fontFamily];
    const sorted = [...new Set(merged.filter((item) => item.length > 0 && item !== DEFAULT_UI_FONT_FAMILY))]
      .sort((a, b) => a.localeCompare(b));
    return [DEFAULT_UI_FONT_FAMILY, ...sorted];
  }, [fontFamilies, settings.fontFamily]);

  const updateSettings = useCallback(
    (updates: Partial<IInterfaceSettings>) => {
      setSettings((prev) => {
        const next = normalizeSettings(
          updates.fontFamily ?? prev.fontFamily,
          updates.fontSize ?? prev.fontSize
        );
        injectUIFontToDOM(next.fontFamily, next.fontSize);

        void (async () => {
          try {
            const stored = await configManagerService.get<IUIConfig>(UI_PLUGIN_CONFIG_KEY);
            await configManagerService.set(UI_PLUGIN_CONFIG_KEY, {
              ...stored,
              fontFamily: next.fontFamily,
              fontSize: next.fontSize,
            });
          } catch {
            // ignore persistence errors
          }
        })();

        return next;
      });
    },
    [configManagerService]
  );

  const updateTransparencyConfig = useCallback(
    (updates: Partial<IWindowTransparencyConfig>) => {
      setTransparencyConfig((prev) => {
        const next = normalizeTransparencyConfig({ ...prev, ...updates });
        void configManagerService.setField(TERMINAL_PLUGIN_CONFIG_KEY, 'transparency', next).catch(() => { });
        return next;
      });
    },
    [configManagerService]
  );

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const stored = await configManagerService.get<IUIConfig>(UI_PLUGIN_CONFIG_KEY);
        if (!active) {
          return;
        }
        setSettings(normalizeSettings(stored?.fontFamily, stored?.fontSize));
      } catch {
        if (active) {
          setSettings(createDefaultSettings());
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
        if (!active) {
          return;
        }
        const families = fonts
          .map((f) => f.family)
          .filter((f): f is string => typeof f === 'string' && f.length > 0);
        if (families.length > 0) {
          setFontFamilies([...new Set(families)]);
        }
      } catch {
        if (active) {
          setFontFamilies(DEFAULT_UI_FONT_FAMILIES);
        }
      }
    };
    loadFonts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    configManagerService.getField<IWindowTransparencyConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'transparency')
      .then((stored) => {
        if (active) {
          setTransparencyConfig(normalizeTransparencyConfig(stored));
        }
      })
      .catch(() => {
        if (active) {
          setTransparencyConfig(normalizeTransparencyConfig(null));
        }
      });
    return () => {
      active = false;
    };
  }, [configManagerService]);

  return (
    <FieldGroup className="tm:gap-5">
      <Card className="tm:gap-0 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.interface.settings-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel htmlFor="ui-font-family" className={horizontalFieldLabelCls}>
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.interface.font-family')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.interface.font-family-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <div
                  ref={fontComboboxAnchorRef}
                  className={`
                    tm:relative
                    ${fontFamilyControlWidthCls}
                  `}
                >
                  <Combobox
                    value={settings.fontFamily}
                    items={resolvedFontFamilies}
                    onValueChange={(value) => {
                      if (value == null) {
                        return;
                      }
                      updateSettings({ fontFamily: value });
                    }}
                  >
                    <ComboboxInput
                      id="ui-font-family"
                      className="tm:h-10 tm:w-full"
                      placeholder={localeService.t('settings-ui.interface.font-family-placeholder')}
                    />
                    <ComboboxContent
                      anchor={fontComboboxAnchorRef}
                    >
                      <ComboboxEmpty>
                        {localeService.t('settings-ui.interface.font-family-empty')}
                      </ComboboxEmpty>
                      <ComboboxList className="tm:max-h-72">
                        {(family: string) => (
                          <ComboboxItem key={family} value={family}>
                            {family === DEFAULT_UI_FONT_FAMILY
                              ? localeService.t('settings-ui.interface.font-family-default')
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
              <FieldLabel htmlFor="ui-font-size" className={horizontalFieldLabelCls}>
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('settings-ui.interface.font-size')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('settings-ui.interface.font-size-description')}
                </span>
              </FieldLabel>
              <FieldContent className="tm:flex-none tm:items-end">
                <Input
                  id="ui-font-size"
                  className={`
                    ${inputCls}
                    ${compactControlWidthCls}
                  `}
                  type="number"
                  min={UI_FONT_SIZE_MIN}
                  max={UI_FONT_SIZE_MAX}
                  value={settings.fontSize}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    updateSettings({
                      fontSize: Number.isNaN(next) ? DEFAULT_UI_FONT_SIZE : next,
                    });
                  }}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="tm:gap-0 tm:py-0">
        <CardHeader
          className={cn('tm:bg-black/10 tm:py-3', {
            'tm:border-b tm:border-line tm:pb-3': transparencyConfig.enabled,
          })}
        >
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-transparency-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('settings-ui.interface.transparency-enable')}
              </FieldLabel>
              <Switch
                id="settings-transparency-enabled"
                checked={transparencyConfig.enabled}
                onCheckedChange={(checked) => updateTransparencyConfig({ enabled: checked })}
              />
            </div>

            <CardDescription className="tm:text-xs">
              {localeService.t('settings-ui.interface.transparency-enable-description')}
            </CardDescription>
          </div>
        </CardHeader>

        {transparencyConfig.enabled && (
          <CardContent>
            <FieldGroup className="tm:my-4 tm:gap-4">
              <Field orientation="horizontal">
                <FieldLabel
                  className={cn('tm:h-8 tm:w-28 tm:flex-none tm:shrink-0 tm:text-xs/8')}
                >
                  {localeService.t('settings-ui.interface.transparency-opacity')}
                </FieldLabel>
                <FieldContent className="tm:items-end">
                  <div className="tm:flex tm:w-48 tm:items-center tm:gap-3">
                    <Slider
                      min={OPACITY_MIN}
                      max={OPACITY_MAX}
                      step={1}
                      value={[Math.round(transparencyConfig.opacity * 100)]}
                      onValueChange={(value) => {
                        const percent = Array.isArray(value) ? value[0] : value;
                        updateTransparencyConfig({ opacity: percent / 100 });
                      }}
                      className="tm:flex-1"
                    />
                    <span className="tm:w-10 tm:text-right tm:text-xs tm:text-grey-fg tm:tabular-nums">
                      {Math.round(transparencyConfig.opacity * 100)}
                      %
                    </span>
                  </div>
                </FieldContent>
              </Field>
            </FieldGroup>
          </CardContent>
        )}
      </Card>
    </FieldGroup>
  );
}
