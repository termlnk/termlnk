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

import type { IIslandSettings, IIslandSoundConfig, IIslandSoundEventConfig } from './island-settings.types';
import { LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, Field, FieldContent, FieldGroup, FieldLabel, Slider, Switch, useDependency } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { Volume1, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SOUND_CONFIG_KEY_TO_URL } from '../../assets/sound-urls';
import { ISLAND_SETTINGS_CONFIG_KEY, normalizeIslandSettings } from './island-settings.types';
import { SoundEventRow } from './SoundEventRow';

export function IslandTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [settings, setSettings] = useState<IIslandSettings>(() => normalizeIslandSettings(null));
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  const updateSettings = useCallback(
    (updates: Partial<IIslandSettings>) => {
      setSettings((prev) => {
        const next = normalizeIslandSettings({ ...prev, ...updates });
        void configManagerService.setField(ISLAND_SETTINGS_CONFIG_KEY, 'settings', next);
        return next;
      });
    },
    [configManagerService]
  );

  const updateSound = useCallback(
    (updates: Partial<IIslandSoundConfig>) => {
      setSettings((prev) => {
        const next = normalizeIslandSettings({ ...prev, sound: { ...prev.sound, ...updates } });
        void configManagerService.setField(ISLAND_SETTINGS_CONFIG_KEY, 'settings', next);
        return next;
      });
    },
    [configManagerService]
  );

  const updateSoundEvent = useCallback(
    (eventKey: keyof IIslandSoundConfig, updates: Partial<IIslandSoundEventConfig>) => {
      setSettings((prev) => {
        const currentEvent = prev.sound[eventKey];
        if (typeof currentEvent !== 'object') {
          return prev;
        }
        const next = normalizeIslandSettings({
          ...prev,
          sound: { ...prev.sound, [eventKey]: { ...currentEvent, ...updates } },
        });
        void configManagerService.setField(ISLAND_SETTINGS_CONFIG_KEY, 'settings', next);
        return next;
      });
    },
    [configManagerService]
  );

  const playPreview = useCallback(
    (configKey: keyof IIslandSoundConfig) => {
      const url = SOUND_CONFIG_KEY_TO_URL[configKey];
      if (!url) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const volume = settings.sound.volume / 100;
      const playBuffer = (buffer: AudioBuffer) => {
        const gain = ctx.createGain();
        gain.gain.value = volume;
        gain.connect(ctx.destination);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.start();
      };

      const cached = audioBufferCacheRef.current.get(configKey);
      if (cached) {
        playBuffer(cached);
        return;
      }

      void fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((audioBuffer) => {
          audioBufferCacheRef.current.set(configKey, audioBuffer);
          playBuffer(audioBuffer);
        })
        .catch((err) => {
          console.error('[IslandTab] Failed to play preview:', err);
        });
    },
    [settings.sound.volume]
  );

  useEffect(() => {
    let active = true;
    configManagerService.getField<IIslandSettings>(ISLAND_SETTINGS_CONFIG_KEY, 'settings')
      .then((stored) => {
        if (active) {
          setSettings(normalizeIslandSettings(stored));
        }
      })
      .catch((err) => {
        console.error('[IslandTab] Failed to load island settings:', err);
        if (active) {
          setSettings(normalizeIslandSettings(null));
        }
      });
    return () => {
      active = false;
    };
  }, [configManagerService]);

  return (
    <FieldGroup className="tm:gap-5">
      {/* Island Enable/Disable */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:bg-black/10 tm:py-3">
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-island-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('island-ui.island-tab.enable')}
              </FieldLabel>
              <Switch
                id="settings-island-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSettings({ enabled: checked })}
              />
            </div>
            <CardDescription className="tm:text-xs">
              {localeService.t('island-ui.island-tab.enable-description')}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Sound Settings */}
      {settings.enabled && (
        <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
          <CardHeader
            className={cn('tm:bg-black/10 tm:py-3', {
              'tm:border-b tm:border-line': settings.sound.enabled,
            })}
          >
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-island-sound-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('island-ui.island-tab.sound-title')}
              </FieldLabel>
              <Switch
                id="settings-island-sound-enabled"
                checked={settings.sound.enabled}
                onCheckedChange={(checked) => updateSound({ enabled: checked })}
              />
            </div>
          </CardHeader>

          {settings.sound.enabled && (
            <CardContent>
              <FieldGroup className="tm:my-4 tm:gap-5">
                {/* Volume Slider */}
                <Field orientation="horizontal">
                  <FieldLabel className="tm:h-8 tm:w-20 tm:flex-none tm:shrink-0 tm:text-sm/8 tm:font-normal">
                    {localeService.t('island-ui.island-tab.sound-volume')}
                  </FieldLabel>
                  <FieldContent className="tm:items-end">
                    <div className="tm:flex tm:w-full tm:max-w-[260px] tm:items-center tm:gap-3">
                      <Volume1 className="tm:size-4 tm:shrink-0 tm:text-grey-fg" />
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[settings.sound.volume]}
                        onValueChange={(value) => {
                          const v = Array.isArray(value) ? value[0] : value;
                          updateSound({ volume: v });
                        }}
                        className="tm:flex-1"
                      />
                      <Volume2 className="tm:size-4 tm:shrink-0 tm:text-grey-fg" />
                      <span className="tm:w-10 tm:text-right tm:text-xs tm:text-grey-fg tm:tabular-nums">
                        {settings.sound.volume}
                        %
                      </span>
                    </div>
                  </FieldContent>
                </Field>

                {/* Session Events */}
                <div className="tm:flex tm:flex-col tm:gap-3">
                  <h4 className="tm:text-xs tm:font-semibold tm:text-grey-fg2">
                    {localeService.t('island-ui.island-tab.category-session')}
                  </h4>
                  <Card className="tm:gap-0 tm:bg-black/15 tm:py-0">
                    <CardContent className="tm:py-3">
                      <FieldGroup className="tm:gap-4">
                        <SoundEventRow
                          id="settings-island-sound-session-start"
                          labelKey="island-ui.island-tab.event-session-start"
                          descriptionKey="island-ui.island-tab.event-session-start-description"
                          checked={settings.sound.sessionStart.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('sessionStart', { enabled: checked })}
                          onPlay={() => playPreview('sessionStart')}
                        />
                        <SoundEventRow
                          id="settings-island-sound-task-complete"
                          labelKey="island-ui.island-tab.event-task-complete"
                          descriptionKey="island-ui.island-tab.event-task-complete-description"
                          checked={settings.sound.taskComplete.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('taskComplete', { enabled: checked })}
                          onPlay={() => playPreview('taskComplete')}
                        />
                        <SoundEventRow
                          id="settings-island-sound-task-error"
                          labelKey="island-ui.island-tab.event-task-error"
                          descriptionKey="island-ui.island-tab.event-task-error-description"
                          checked={settings.sound.taskError.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('taskError', { enabled: checked })}
                          onPlay={() => playPreview('taskError')}
                        />
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </div>

                {/* Interaction Events */}
                <div className="tm:flex tm:flex-col tm:gap-3">
                  <h4 className="tm:text-xs tm:font-semibold tm:text-grey-fg2">
                    {localeService.t('island-ui.island-tab.category-interaction')}
                  </h4>
                  <Card className="tm:gap-0 tm:bg-black/15 tm:py-0">
                    <CardContent className="tm:py-3">
                      <FieldGroup className="tm:gap-4">
                        <SoundEventRow
                          id="settings-island-sound-needs-approval"
                          labelKey="island-ui.island-tab.event-needs-approval"
                          descriptionKey="island-ui.island-tab.event-needs-approval-description"
                          checked={settings.sound.needsApproval.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('needsApproval', { enabled: checked })}
                          onPlay={() => playPreview('needsApproval')}
                        />
                        <SoundEventRow
                          id="settings-island-sound-task-confirmed"
                          labelKey="island-ui.island-tab.event-task-confirmed"
                          descriptionKey="island-ui.island-tab.event-task-confirmed-description"
                          checked={settings.sound.taskConfirmed.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('taskConfirmed', { enabled: checked })}
                          onPlay={() => playPreview('taskConfirmed')}
                        />
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </div>

                {/* System Events */}
                <div className="tm:flex tm:flex-col tm:gap-3">
                  <h4 className="tm:text-xs tm:font-semibold tm:text-grey-fg2">
                    {localeService.t('island-ui.island-tab.category-system')}
                  </h4>
                  <Card className="tm:gap-0 tm:bg-black/15 tm:py-0">
                    <CardContent className="tm:py-3">
                      <FieldGroup className="tm:gap-4">
                        <SoundEventRow
                          id="settings-island-sound-context-limit"
                          labelKey="island-ui.island-tab.event-context-limit"
                          descriptionKey="island-ui.island-tab.event-context-limit-description"
                          checked={settings.sound.contextLimit.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('contextLimit', { enabled: checked })}
                          onPlay={() => playPreview('contextLimit')}
                        />
                        <SoundEventRow
                          id="settings-island-sound-rapid-submit"
                          labelKey="island-ui.island-tab.event-rapid-submit"
                          descriptionKey="island-ui.island-tab.event-rapid-submit-description"
                          checked={settings.sound.rapidSubmitDetection.enabled}
                          onCheckedChange={(checked) => updateSoundEvent('rapidSubmitDetection', { enabled: checked })}
                          onPlay={() => playPreview('rapidSubmitDetection')}
                        />
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </div>

              </FieldGroup>
            </CardContent>
          )}
        </Card>
      )}
    </FieldGroup>
  );
}
