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

import type { IPortForwardingRule, IPortForwardingRuleCreateInput, IPortForwardingRuleUpdateInput } from '@termlnk/rpc';
import type { CSSProperties } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, Field, FieldContent, FieldLabel, Input, Tooltip, TooltipContent, TooltipTrigger, useDependency } from '@termlnk/design';
import { PortForwardingType } from '@termlnk/rpc';
import { CircleHelp } from 'lucide-react';
import { HostPickerInput } from './HostPickerInput';

const PORT_FIELD_STYLE: CSSProperties = {
  width: 158,
  flexGrow: 0,
  flexShrink: 0,
};

export interface IRuleFormValues {
  label: string;
  type: PortForwardingType;
  hostId: string;
  bindAddress: string;
  bindPort: number;
  destinationAddress: string;
  destinationPort: number;
}

export interface IRuleFormProps {
  values: IRuleFormValues;
  onChange: (values: IRuleFormValues) => void;
}

export const EMPTY_FORM_VALUES: IRuleFormValues = {
  label: '',
  type: PortForwardingType.LOCAL,
  hostId: '',
  bindAddress: '127.0.0.1',
  bindPort: 0,
  destinationAddress: '',
  destinationPort: 0,
};

export function fromRule(rule: IPortForwardingRule): IRuleFormValues {
  return {
    label: rule.label,
    type: rule.type,
    hostId: rule.hostId,
    bindAddress: rule.bindAddress,
    bindPort: rule.bindPort,
    destinationAddress: rule.destinationAddress ?? '',
    destinationPort: rule.destinationPort ?? 0,
  };
}

export function RuleForm({ values, onChange }: IRuleFormProps) {
  const localeService = useDependency(LocaleService);
  const type = values.type;

  const patch = (next: Partial<IRuleFormValues>): void => {
    onChange({ ...values, ...next });
  };

  const showLocalPort = type !== PortForwardingType.REMOTE;
  const showDestination = type !== PortForwardingType.DYNAMIC;
  const hostLabelKey = type === PortForwardingType.REMOTE
    ? 'port-forwarding-ui.editor.remoteHost'
    : 'port-forwarding-ui.editor.intermediateHost';
  const bindPortLabelKey = showLocalPort
    ? 'port-forwarding-ui.editor.localPort'
    : 'port-forwarding-ui.editor.remotePort';

  const bindAddressAndPort = (
    <div className="tm:flex tm:gap-3">
      <Field className="tm:min-w-0 tm:flex-1">
        <FieldLabel>
          {localeService.t('port-forwarding-ui.editor.bindAddress')}
          {type === PortForwardingType.REMOTE && (
            <Tooltip delay={200}>
              <TooltipTrigger asChild>
                <CircleHelp className={cn('tm:size-3.5 tm:cursor-help tm:text-grey-fg')} />
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {localeService.t('port-forwarding-ui.editor.bindAddressRemoteTip')}
              </TooltipContent>
            </Tooltip>
          )}
        </FieldLabel>
        <FieldContent>
          <Input
            value={values.bindAddress}
            onChange={(e) => patch({ bindAddress: e.target.value })}
            placeholder="127.0.0.1"
          />
        </FieldContent>
      </Field>
      <Field style={PORT_FIELD_STYLE}>
        <FieldLabel>{localeService.t(bindPortLabelKey)}</FieldLabel>
        <FieldContent>
          <Input
            type="number"
            min={0}
            max={65535}
            value={values.bindPort || ''}
            onChange={(e) => patch({ bindPort: Number.parseInt(e.target.value || '0', 10) })}
          />
        </FieldContent>
      </Field>
    </div>
  );

  const hostPicker = (
    <HostPickerInput
      hostId={values.hostId || null}
      label={localeService.t(hostLabelKey)}
      onChange={(id) => patch({ hostId: id })}
    />
  );

  return (
    <>
      <Field>
        <FieldLabel>{localeService.t('port-forwarding-ui.editor.label')}</FieldLabel>
        <FieldContent>
          <Input
            value={values.label}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Label"
          />
        </FieldContent>
      </Field>

      {type === PortForwardingType.REMOTE
        ? (
          <>
            {hostPicker}
            {bindAddressAndPort}
          </>
        )
        : (
          <>
            {bindAddressAndPort}
            {hostPicker}
          </>
        )}

      {showDestination && (
        <div className="tm:flex tm:gap-3">
          <Field className="tm:min-w-0 tm:flex-1">
            <FieldLabel>{localeService.t('port-forwarding-ui.editor.destinationAddress')}</FieldLabel>
            <FieldContent>
              <Input
                value={values.destinationAddress}
                onChange={(e) => patch({ destinationAddress: e.target.value })}
                placeholder="127.0.0.1"
              />
            </FieldContent>
          </Field>
          <Field style={PORT_FIELD_STYLE}>
            <FieldLabel>{localeService.t('port-forwarding-ui.editor.destinationPort')}</FieldLabel>
            <FieldContent>
              <Input
                type="number"
                min={1}
                max={65535}
                value={values.destinationPort || ''}
                onChange={(e) => patch({ destinationPort: Number.parseInt(e.target.value || '0', 10) })}
              />
            </FieldContent>
          </Field>
        </div>
      )}
    </>
  );
}

export function toCreateInput(values: IRuleFormValues): IPortForwardingRuleCreateInput {
  return {
    label: values.label,
    type: values.type,
    hostId: values.hostId,
    bindAddress: values.bindAddress,
    bindPort: values.bindPort,
    destinationAddress: values.type === PortForwardingType.DYNAMIC ? null : values.destinationAddress,
    destinationPort: values.type === PortForwardingType.DYNAMIC ? null : values.destinationPort,
  };
}

export function toUpdateInput(values: IRuleFormValues): IPortForwardingRuleUpdateInput {
  return {
    label: values.label,
    type: values.type,
    hostId: values.hostId,
    bindAddress: values.bindAddress,
    bindPort: values.bindPort,
    destinationAddress: values.type === PortForwardingType.DYNAMIC ? null : values.destinationAddress,
    destinationPort: values.type === PortForwardingType.DYNAMIC ? null : values.destinationPort,
  };
}
