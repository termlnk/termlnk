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

import type { IRuleFormValues } from './rule-editor/RuleForm';
import { LocaleService } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { IPortForwardingService, PortForwardingType } from '@termlnk/rpc';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IRuleDialogService } from '../services/rule-dialog/rule-dialog.service';
import { useRule } from './hooks/use-rule-list';
import { DiagramFigure } from './rule-editor/DiagramFigure';
import { EMPTY_FORM_VALUES, fromRule, RuleForm, toCreateInput, toUpdateInput } from './rule-editor/RuleForm';
import { TypeSwitcher } from './rule-editor/TypeSwitcher';

export const RULE_DIALOG_COMPONENT_NAME = 'port-forwarding-ui.component.rule-dialog';

type FormsByType = Record<PortForwardingType, IRuleFormValues>;

const EMPTY_FORMS: FormsByType = {
  [PortForwardingType.LOCAL]: { ...EMPTY_FORM_VALUES, type: PortForwardingType.LOCAL },
  [PortForwardingType.REMOTE]: { ...EMPTY_FORM_VALUES, type: PortForwardingType.REMOTE },
  [PortForwardingType.DYNAMIC]: { ...EMPTY_FORM_VALUES, type: PortForwardingType.DYNAMIC },
};

export function RuleDialog() {
  const localeService = useDependency(LocaleService);
  const ruleDialog = useDependency(IRuleDialogService);
  const portForwardingService = useDependency(IPortForwardingService);
  const state = useObservable(ruleDialog.state$, ruleDialog.getState());

  const editingRule = useRule(state.mode === 'edit' ? state.ruleId ?? null : null);
  // Each PortForwardingType keeps its own working copy so switching tabs
  // doesn't bleed Remote-shaped data into a Local/Dynamic form. Switching
  // back restores whatever the user had left in that tab.
  const [forms, setForms] = useState<FormsByType>(EMPTY_FORMS);
  const [activeType, setActiveType] = useState<PortForwardingType>(PortForwardingType.LOCAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = forms[activeType];

  // Reset whenever the dialog target changes. Edit mode seeds only the rule's
  // own type; the other tabs stay empty until the user fills them in (and only
  // get persisted when the user actually switches+saves there).
  const resetKey = state.open
    ? `${state.mode}:${state.ruleId ?? ''}:${state.initialType ?? ''}:${editingRule?.id ?? ''}`
    : '';
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKeyRef.current) {
      return;
    }
    prevResetKeyRef.current = resetKey;

    if (!state.open) {
      setError('');
      setBusy(false);
      setForms(EMPTY_FORMS);
      setActiveType(PortForwardingType.LOCAL);
      return;
    }
    if (state.mode === 'create' && state.initialType) {
      setForms(EMPTY_FORMS);
      setActiveType(state.initialType);
      return;
    }
    if (state.mode === 'edit' && editingRule) {
      setForms({ ...EMPTY_FORMS, [editingRule.type]: fromRule(editingRule) });
      setActiveType(editingRule.type);
    }
  }, [resetKey, state.open, state.mode, state.initialType, editingRule]);

  const handleClose = useCallback(() => {
    ruleDialog.close();
  }, [ruleDialog]);

  const handleChange = useCallback((next: IRuleFormValues) => {
    setForms((prev) => ({ ...prev, [activeType]: next }));
  }, [activeType]);

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (state.mode === 'create') {
        await portForwardingService.createRule(toCreateInput(current));
      } else if (state.ruleId) {
        await portForwardingService.updateRule(state.ruleId, toUpdateInput(current));
      }
      ruleDialog.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [state.mode, state.ruleId, current, portForwardingService, ruleDialog]);

  const canSave = !!current.hostId && (
    current.type === PortForwardingType.DYNAMIC
      ? !!current.bindPort
      : !!current.bindPort && !!current.destinationAddress && !!current.destinationPort
  );

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      <TypeSwitcher value={activeType} onChange={setActiveType} />

      <DiagramFigure type={activeType} />

      <RuleForm values={current} onChange={handleChange} />

      {error && <div className={cn('tm:text-[12px] tm:text-red')}>{error}</div>}

      <div className="tm:flex tm:justify-end tm:gap-2 tm:pt-1">
        <Button variant="outline" size="sm" onClick={handleClose}>
          {localeService.t('port-forwarding-ui.action.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSave || busy}
        >
          {localeService.t(state.mode === 'create'
            ? 'port-forwarding-ui.action.create'
            : 'port-forwarding-ui.action.save')}
        </Button>
      </div>
    </div>
  );
}
