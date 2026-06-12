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

import type { PortForwardingAuthEvent, PortForwardingHostKeyAction } from '@termlnk/rpc';
import type { Observable, Subscription } from 'rxjs';
import { Inject, Injector, LocaleService, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IPortForwardingService, PortForwardingTunnelStatus } from '@termlnk/rpc';
import { ComponentManagerService, IDialogService } from '@termlnk/ui';
import { BehaviorSubject, EMPTY, merge, switchMap } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { HostKeyPromptDialog } from '../views/auth/HostKeyPromptDialog';
import { KeyboardInteractiveDialog } from '../views/auth/KeyboardInteractiveDialog';
import { HOST_KEY_PROMPT_DIALOG_COMPONENT_NAME, KB_INTERACTIVE_DIALOG_COMPONENT_NAME } from './component-names';

export interface IPendingAuthEvent {
  ruleId: string;
  event: PortForwardingAuthEvent;
  connectionFailed?: boolean;
  error?: string;
}

const HOST_KEY_DIALOG_ID = 'port-forwarding-ui.host-key-prompt.dialog';
const KB_INTERACTIVE_DIALOG_ID = 'port-forwarding-ui.kb-interactive.dialog';

export class AuthEventController extends RxDisposable {
  private readonly _pendingEvent$ = new BehaviorSubject<IPendingAuthEvent | null>(null);
  readonly pendingEvent$: Observable<IPendingAuthEvent | null> = this._pendingEvent$.asObservable();
  private _stateSubscription: Subscription | null = null;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IPortForwardingService private readonly _portForwardingService: IPortForwardingService
  ) {
    super();

    this._initComponents();
    this._initListeners();
  }

  respondHostKeyPrompt(ruleId: string, action: PortForwardingHostKeyAction): void {
    void this._portForwardingService.respondHostKeyPrompt(ruleId, action);
    this._clearPendingState();
    this._dialogService.close(HOST_KEY_DIALOG_ID);
  }

  respondKeyboardInteractive(ruleId: string, responses: string[]): void {
    void this._portForwardingService.respondKeyboardInteractive(ruleId, responses);
    this._clearPendingState();
    this._dialogService.close(KB_INTERACTIVE_DIALOG_ID);
  }

  respondChangePassword(ruleId: string, newPassword: string): void {
    void this._portForwardingService.respondChangePassword(ruleId, newPassword);
    this._clearPendingState();
    this._dialogService.close(KB_INTERACTIVE_DIALOG_ID);
  }

  override dispose(): void {
    super.dispose();
    this._stateSubscription?.unsubscribe();
    this._stateSubscription = null;
    this._pendingEvent$.complete();
  }

  private _clearPendingState(): void {
    this._stateSubscription?.unsubscribe();
    this._stateSubscription = null;
    this._pendingEvent$.next(null);
  }

  private _watchTunnelState(ruleId: string): void {
    this._stateSubscription?.unsubscribe();
    this._stateSubscription = this._portForwardingService.state$(ruleId).pipe(
      filter((s) => s.status === PortForwardingTunnelStatus.FAILED),
      take(1),
      takeUntil(this.dispose$)
    ).subscribe((state) => {
      const current = this._pendingEvent$.getValue();
      if (current && current.ruleId === ruleId) {
        this._pendingEvent$.next({ ...current, connectionFailed: true, error: state.error });
      }
    });
  }

  private _initComponents(): void {
    this.disposeWithMe(
      this._componentManagerService.register(
        HOST_KEY_PROMPT_DIALOG_COMPONENT_NAME,
        connectInjector(HostKeyPromptDialog, this._injector)
      )
    );
    this.disposeWithMe(
      this._componentManagerService.register(
        KB_INTERACTIVE_DIALOG_COMPONENT_NAME,
        connectInjector(KeyboardInteractiveDialog, this._injector)
      )
    );
  }

  private _initListeners(): void {
    this._portForwardingService.rules$.pipe(
      switchMap((rules) => {
        if (rules.length === 0) {
          return EMPTY;
        }
        return merge(
          ...rules.map((rule) => this._portForwardingService.authEvent$(rule.id))
        );
      }),
      takeUntil(this.dispose$)
    ).subscribe((event) => {
      this._handleAuthEvent(event);
    });
  }

  private _handleAuthEvent(event: PortForwardingAuthEvent): void {
    const ruleId = event.ruleId;

    switch (event.type) {
      case 'host_key_prompt':
        this._pendingEvent$.next({ ruleId, event });
        this._dialogService.open({
          id: HOST_KEY_DIALOG_ID,
          draggable: true,
          width: 480,
          title: { title: this._localeService.t('port-forwarding-ui.menu.title') },
          children: { componentId: HOST_KEY_PROMPT_DIALOG_COMPONENT_NAME },
          disableAutoFocus: true,
          onClose: () => this.respondHostKeyPrompt(ruleId, 'reject'),
        });
        this._watchTunnelState(ruleId);
        break;
      case 'keyboard_interactive':
        this._pendingEvent$.next({ ruleId, event });
        this._dialogService.open({
          id: KB_INTERACTIVE_DIALOG_ID,
          draggable: true,
          width: 420,
          title: { title: this._localeService.t('port-forwarding-ui.auth.keyboardInteractive.title') },
          children: { componentId: KB_INTERACTIVE_DIALOG_COMPONENT_NAME },
          disableAutoFocus: true,
          onClose: () => this.respondKeyboardInteractive(ruleId, []),
        });
        this._watchTunnelState(ruleId);
        break;
      case 'change_password':
        this._pendingEvent$.next({ ruleId, event });
        this._dialogService.open({
          id: KB_INTERACTIVE_DIALOG_ID,
          draggable: true,
          width: 420,
          title: { title: this._localeService.t('port-forwarding-ui.auth.changePassword.title') },
          children: { componentId: KB_INTERACTIVE_DIALOG_COMPONENT_NAME },
          disableAutoFocus: true,
          onClose: () => this.respondChangePassword(ruleId, ''),
        });
        this._watchTunnelState(ruleId);
        break;
      case 'auth_failed':
      case 'banner':
        break;
    }
  }
}
