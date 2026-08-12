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

import type {
  IACPDiscoveryService,
  IACPProviderDescriptor,
  IACPProviderStatus,
} from '@termlnk/acp';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { IRPCClientService } from '../rpc-client.service';

export class ACPDiscoveryService extends Disposable implements IACPDiscoveryService {
  private readonly _providers$ = new BehaviorSubject<IACPProviderStatus[]>([]);
  readonly providers$: Observable<IACPProviderStatus[]> = this._providers$.asObservable();
  readonly launchableProviders$: Observable<IACPProviderStatus[]>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    const live$ = trpcSubscriptionToObservable<IACPProviderStatus[]>((opts) =>
      this._client.providers$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));

    this.disposeWithMe(live$.subscribe((list) => this._providers$.next(list)));

    this.launchableProviders$ = this.providers$.pipe(
      map((list) =>
        list
          .filter((p) => p.availability.state === 'installed' || p.availability.state === 'on-demand')
          .sort((a, b) => {
            const rank = (s: IACPProviderStatus) => (s.availability.state === 'installed' ? 0 : 1);
            const d = rank(a) - rank(b);
            return d !== 0 ? d : a.descriptor.title.localeCompare(b.descriptor.title);
          })
      )
    );

    // Seed from a one-shot query so the first paint is not empty.
    void this._client.listProviders.query().then((list) => {
      if (this._providers$.getValue().length === 0) {
        this._providers$.next(list);
      }
    }).catch(() => {
      // subscription will fill later
    });
  }

  get providers(): IACPProviderStatus[] {
    return this._providers$.getValue();
  }

  get launchableProviders(): IACPProviderStatus[] {
    return this.providers
      .filter((p) => p.availability.state === 'installed' || p.availability.state === 'on-demand')
      .sort((a, b) => {
        const rank = (s: IACPProviderStatus) => (s.availability.state === 'installed' ? 0 : 1);
        const d = rank(a) - rank(b);
        return d !== 0 ? d : a.descriptor.title.localeCompare(b.descriptor.title);
      });
  }

  getProvider(id: string): IACPProviderStatus | undefined {
    return this.providers.find((p) => p.descriptor.id === id);
  }

  async refresh(): Promise<void> {
    const list = await this._client.refreshProviders.mutate();
    this._providers$.next(list);
  }

  async addUserProvider(descriptor: Omit<IACPProviderDescriptor, 'source'>): Promise<void> {
    await this._client.addUserProvider.mutate({
      ...descriptor,
      command: [...descriptor.command] as [string, ...string[]],
    });
    await this.refresh();
  }

  async removeUserProvider(id: string): Promise<void> {
    await this._client.removeUserProvider.mutate(id);
    await this.refresh();
  }

  override dispose(): void {
    this._providers$.complete();
    super.dispose();
  }

  private get _client() {
    return this._rpcClientService.getClient().acp;
  }
}
