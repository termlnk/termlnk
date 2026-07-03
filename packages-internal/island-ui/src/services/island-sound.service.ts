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

import type { ICespEvent, IIslandSettings, IIslandSoundConfig, IIslandSoundEventConfig } from '@termlnk/island';
import { createIdentifier, Disposable, ILogService, toDisposable } from '@termlnk/core';
import { CespEventCategory, DEFAULT_ISLAND_SOUND_CONFIG, normalizeIslandSoundConfig } from '@termlnk/island';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { BehaviorSubject, filter } from 'rxjs';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from '@termlnk/agent';
import { CESP_SOUND_ASSET_URLS } from '../assets/sound-urls';
import { SOUND_DEBOUNCE_MS } from '../common/constants';
import { IIslandUIStateService } from './island-state.service';

/** CESP event category → key on {@link IIslandSoundConfig} controlling whether that sound plays. */
const CESP_TO_CONFIG_KEY: Partial<Record<CespEventCategory, keyof IIslandSoundConfig>> = {
  [CespEventCategory.SessionStart]: 'sessionStart',
  [CespEventCategory.TaskAcknowledge]: 'taskConfirmed',
  [CespEventCategory.TaskComplete]: 'taskComplete',
  [CespEventCategory.TaskError]: 'taskError',
  [CespEventCategory.InputRequired]: 'needsApproval',
  [CespEventCategory.ResourceLimit]: 'contextLimit',
  [CespEventCategory.UserSpam]: 'rapidSubmitDetection',
};

export interface IIslandSoundService {
  /** Play a sound preview for the given CESP category (ignores debounce and config). */
  playPreview(category: CespEventCategory): void;
}

export const IIslandSoundService = createIdentifier<IIslandSoundService>('island-ui.island-sound-service');

export class IslandSoundService extends Disposable implements IIslandSoundService {
  private _audioContext: AudioContext | null = null;
  private _gainNode: GainNode | null = null;
  private readonly _audioBuffers = new Map<CespEventCategory, AudioBuffer>();
  private readonly _soundConfig$ = new BehaviorSubject<IIslandSoundConfig>(DEFAULT_ISLAND_SOUND_CONFIG);
  private readonly _lastPlayTimes = new Map<CespEventCategory, number>();

  constructor(
    @IIslandUIStateService private readonly _stateService: IIslandUIStateService,
    @ILogService private readonly _logService: ILogService,
    @IConfigManagerService private readonly _configManagerService: IConfigManagerService
  ) {
    super();

    this._initConfig();
    this._preloadSounds();
    this._subscribeToEvents();

    this.disposeWithMe(toDisposable(() => {
      this._soundConfig$.complete();
      this._audioBuffers.clear();
      this._lastPlayTimes.clear();
      if (this._audioContext) {
        void this._audioContext.close();
        this._audioContext = null;
        this._gainNode = null;
      }
    }));
  }

  playPreview(category: CespEventCategory): void {
    this._play(category);
  }

  private _initConfig(): void {
    void this._loadConfig();
    this.disposeWithMe(
      this._configManagerService.onChanged$().pipe(
        filter((event) => event.key === AGENT_CORE_PLUGIN_CONFIG_KEY
          && (event.subKey === 'islandSettings' || event.subKey === undefined))
      ).subscribe(() => {
        void this._loadConfig();
      })
    );
  }

  private async _loadConfig(): Promise<void> {
    try {
      const settings = await this._configManagerService.getField<IIslandSettings>(
        AGENT_CORE_PLUGIN_CONFIG_KEY,
        'islandSettings'
      );
      const soundConfig = normalizeIslandSoundConfig(settings?.sound);
      this._soundConfig$.next(soundConfig);
      this._updateGain(soundConfig.volume);
    } catch (err) {
      this._logService.error('[IslandSoundService]', 'Failed to load config:', err);
    }
  }

  private _preloadSounds(): void {
    const entries = Array.from(CESP_SOUND_ASSET_URLS.entries());
    void Promise.allSettled(
      entries.map(async ([category, url]) => {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = this._ensureAudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          this._audioBuffers.set(category, audioBuffer);
        } catch (err) {
          this._logService.error('[IslandSoundService]', `Failed to preload sound: ${category}`, err);
        }
      })
    );
  }

  private _subscribeToEvents(): void {
    this.disposeWithMe(
      this._stateService.cespEvent$.subscribe((event) => {
        this._handleCespEvent(event);
      })
    );
  }

  private _handleCespEvent(event: ICespEvent): void {
    const config = this._soundConfig$.getValue();
    if (!config.enabled) {
      return;
    }

    const configKey = CESP_TO_CONFIG_KEY[event.category];
    if (configKey) {
      const eventConfig = config[configKey] as IIslandSoundEventConfig | undefined;
      if (eventConfig && !eventConfig.enabled) {
        return;
      }
    }

    const now = Date.now();
    const lastPlayed = this._lastPlayTimes.get(event.category);
    if (lastPlayed !== undefined && now - lastPlayed < SOUND_DEBOUNCE_MS) {
      return;
    }

    this._play(event.category);
  }

  private _ensureAudioContext(): AudioContext {
    if (!this._audioContext) {
      this._audioContext = new AudioContext();
      this._gainNode = this._audioContext.createGain();
      this._gainNode.connect(this._audioContext.destination);
      this._updateGain(this._soundConfig$.getValue().volume);
    }
    return this._audioContext;
  }

  private _updateGain(volume: number): void {
    if (this._gainNode) {
      this._gainNode.gain.value = volume / 100;
    }
  }

  private _play(category: CespEventCategory): void {
    const buffer = this._audioBuffers.get(category);
    if (!buffer) {
      return;
    }

    const context = this._ensureAudioContext();

    // Resume if suspended (Chromium autoplay policy)
    if (context.state === 'suspended') {
      void context.resume();
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this._gainNode!);
    source.start();

    this._lastPlayTimes.set(category, Date.now());
  }
}
