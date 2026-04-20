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

import type { IMcpRegistryInstallInput, IMcpRegistryInstallOption, IMcpRegistryItem, IMcpServer, McpRemoteProtocol, McpServerConfig, McpTransportType } from '@termlnk/agent';
import type { ComponentType } from 'react';
import { IMcpService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, useDependency } from '@termlnk/design';
import { Globe, Network, TerminalSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type McpServerDialogMode = 'create' | 'edit' | 'marketplace';

interface IAddServerForm {
  name: string;
  description: string;
  transport: McpTransportType;
  command: string;
  args: string;
  env: string;
  url: string;
  remoteProtocol: McpRemoteProtocol;
  headers: string;
}

const DEFAULT_FORM: IAddServerForm = {
  name: '',
  description: '',
  transport: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  remoteProtocol: 'streamable-http',
  headers: '',
};

function parseKeyValueLines(value: string, separator: '=' | ':'): Record<string, string> | undefined {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(separator);
      if (index < 0) {
        return null;
      }

      const key = line.slice(0, index).trim();
      const parsedValue = line.slice(index + 1).trim();
      if (!key) {
        return null;
      }

      return [key, parsedValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function stringifyKeyValueLines(value?: Record<string, string>, separator: '=' | ': ' = '='): string {
  if (!value) {
    return '';
  }

  return Object.entries(value)
    .map(([key, itemValue]) => `${key}${separator}${itemValue}`)
    .join('\n');
}

function createServerConfig(form: IAddServerForm): McpServerConfig {
  if (form.transport === 'stdio') {
    return {
      type: 'stdio',
      command: form.command.trim(),
      args: form.args.trim() ? form.args.trim().split(/\s+/).filter(Boolean) : undefined,
      env: parseKeyValueLines(form.env, '='),
    };
  }

  return {
    type: 'http',
    url: form.url.trim(),
    protocol: form.remoteProtocol,
    headers: parseKeyValueLines(form.headers, ':'),
  };
}

function createFormFromServer(server: IMcpServer): IAddServerForm {
  if (server.config.type === 'stdio') {
    return {
      name: server.name,
      description: server.description ?? '',
      transport: 'stdio',
      command: server.config.command,
      args: server.config.args?.join(' ') ?? '',
      env: stringifyKeyValueLines(server.config.env),
      url: '',
      remoteProtocol: 'streamable-http',
      headers: '',
    };
  }

  return {
    name: server.name,
    description: server.description ?? '',
    transport: 'http',
    command: '',
    args: '',
    env: '',
    url: server.config.url,
    remoteProtocol: server.config.protocol ?? 'streamable-http',
    headers: stringifyKeyValueLines(server.config.headers, ': '),
  };
}

function createMarketplaceForm(item: IMcpRegistryItem, option?: IMcpRegistryInstallOption): IAddServerForm {
  return {
    name: item.name,
    description: item.description,
    transport: option?.transport ?? item.transport,
    command: '',
    args: '',
    env: '',
    url: '',
    remoteProtocol: option?.config.type === 'http' ? option.config.protocol : 'streamable-http',
    headers: '',
  };
}

function replaceTemplateVariables(value: string, parameters: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => parameters[key]?.trim() ?? '');
}

function materializeRegistryConfig(config: McpServerConfig, parameters: Record<string, string>): McpServerConfig {
  if (config.type === 'stdio') {
    const args = config.args
      ?.map((arg) => replaceTemplateVariables(arg, parameters).trim())
      .filter(Boolean);
    const envEntries = Object.entries(config.env ?? {})
      .map(([key, value]) => [key, replaceTemplateVariables(value, parameters).trim()] as const)
      .filter(([, value]) => value.length > 0);

    return {
      type: 'stdio',
      command: replaceTemplateVariables(config.command, parameters).trim(),
      args: args?.length ? args : undefined,
      env: envEntries.length > 0 ? Object.fromEntries(envEntries) : undefined,
      cwd: config.cwd ? replaceTemplateVariables(config.cwd, parameters).trim() : undefined,
    };
  }

  const headers = Object.entries(config.headers ?? {})
    .map(([key, value]) => [key, replaceTemplateVariables(value, parameters).trim()] as const)
    .filter(([, value]) => value.length > 0);

  return {
    type: 'http',
    url: replaceTemplateVariables(config.url, parameters).trim(),
    protocol: config.protocol,
    headers: headers.length > 0 ? Object.fromEntries(headers) : undefined,
  };
}

function buildInitialParameters(inputs: IMcpRegistryInstallInput[]): Record<string, string> {
  return Object.fromEntries(inputs.map((input) => [input.key, input.defaultValue ?? '']));
}

interface IAddMcpServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void | Promise<void>;
  mode: McpServerDialogMode;
  server?: IMcpServer | null;
  registryItem?: IMcpRegistryItem | null;
}

function SectionHeader({
  icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  const Icon = icon;

  return (
    <div className={cn('tm:mb-4 tm:flex tm:items-center tm:gap-2 tm:text-sm tm:font-semibold tm:text-white')}>
      <Icon className={cn('tm:size-4 tm:text-blue')} />
      <span>{title}</span>
    </div>
  );
}

export function AddMcpServerDialog(props: IAddMcpServerDialogProps) {
  const { open, onOpenChange, onSubmitted, mode, server, registryItem } = props;
  const localeService = useDependency(LocaleService);
  const mcpService = useDependency(IMcpService);

  const [form, setForm] = useState<IAddServerForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedInstallOptionId, setSelectedInstallOptionId] = useState<string>('');
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});

  const selectedInstallOption = useMemo(
    () => registryItem?.installOptions.find((option) => option.id === selectedInstallOptionId) ?? registryItem?.installOptions[0],
    [registryItem, selectedInstallOptionId]
  );
  const registryRequiredInputs = selectedInstallOption?.inputs.filter((input) => input.required) ?? [];
  const registryOptionalInputs = selectedInstallOption?.inputs.filter((input) => !input.required) ?? [];
  const generatedRegistryConfig = useMemo(
    () => selectedInstallOption ? materializeRegistryConfig(selectedInstallOption.config, parameterValues) : null,
    [parameterValues, selectedInstallOption]
  );

  useEffect(() => {
    if (!open) {
      setSaving(false);
      return;
    }

    if (mode === 'edit' && server) {
      setForm(createFormFromServer(server));
      setSelectedInstallOptionId('');
      setParameterValues({});
      return;
    }

    if (mode === 'marketplace' && registryItem) {
      const initialOption = registryItem.installOptions[0];
      setForm(createMarketplaceForm(registryItem, initialOption));
      setSelectedInstallOptionId(initialOption?.id ?? '');
      setParameterValues(buildInitialParameters(initialOption?.inputs ?? []));
      return;
    }

    setForm(DEFAULT_FORM);
    setSelectedInstallOptionId('');
    setParameterValues({});
  }, [mode, open, registryItem, server]);

  const isMarketplaceMode = mode === 'marketplace' && !!registryItem;
  const isRemote = form.transport === 'http';
  const showStdioOption = mode !== 'marketplace' || form.transport === 'stdio';
  const showHttpOption = mode !== 'marketplace' || form.transport === 'http';
  const canSubmit = useMemo(() => {
    if (!form.name.trim()) {
      return false;
    }

    if (isMarketplaceMode) {
      if (!selectedInstallOption || !generatedRegistryConfig) {
        return false;
      }

      if (registryRequiredInputs.some((input) => !parameterValues[input.key]?.trim())) {
        return false;
      }

      return generatedRegistryConfig.type === 'stdio'
        ? generatedRegistryConfig.command.trim().length > 0
        : generatedRegistryConfig.url.trim().length > 0;
    }

    if (isRemote) {
      return form.url.trim().length > 0;
    }

    return form.command.trim().length > 0;
  }, [form.command, form.name, form.url, generatedRegistryConfig, isMarketplaceMode, isRemote, parameterValues, registryRequiredInputs, selectedInstallOption]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setForm(DEFAULT_FORM);
      setSaving(false);
      setSelectedInstallOptionId('');
      setParameterValues({});
    }
  }, [onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || saving) {
      return;
    }

    setSaving(true);

    try {
      if (mode === 'edit' && server) {
        await mcpService.update(server.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          transport: form.transport,
          config: createServerConfig(form),
        });
      } else if (isMarketplaceMode && registryItem && selectedInstallOption && generatedRegistryConfig) {
        await mcpService.add({
          registryId: registryItem.registryId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          transport: selectedInstallOption.transport,
          config: generatedRegistryConfig,
          enabled: true,
        });
      } else {
        await mcpService.add({
          registryId: undefined,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          transport: form.transport,
          config: createServerConfig(form),
          enabled: true,
        });
      }

      handleOpenChange(false);
      await onSubmitted();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [canSubmit, form, generatedRegistryConfig, handleOpenChange, isMarketplaceMode, mcpService, mode, onSubmitted, registryItem, saving, selectedInstallOption, server]);

  function getLocaleKeyByMode(keys: Record<McpServerDialogMode, string>): string {
    return localeService.t(keys[mode]);
  }

  const dialogTitle = getLocaleKeyByMode({
    edit: 'settings-ui.mcp-client.edit-server',
    marketplace: 'settings-ui.mcp-client.marketplace-configure',
    create: 'settings-ui.mcp-client.add-server',
  });
  const dialogDescription = getLocaleKeyByMode({
    edit: 'settings-ui.mcp-client.edit-server-description',
    marketplace: 'settings-ui.mcp-client.marketplace-configure-description',
    create: 'settings-ui.mcp-client.add-server-description',
  });
  const submitLabel = mode === 'edit'
    ? localeService.t('settings-ui.mcp-client.save')
    : localeService.t('settings-ui.mcp-client.add');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader className="tm:gap-1">
          <DialogTitle className="tm:text-base">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="tm:text-xs/relaxed tm:text-light-grey">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="tm:gap-5">
          <FieldGroup className="tm:gap-2">
            <Field>
              <FieldLabel htmlFor="mcp-client-name" className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                {localeService.t('settings-ui.mcp-client.name')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="mcp-client-name"
                  className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={localeService.t('settings-ui.mcp-client.placeholder-name')}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                {localeService.t('settings-ui.mcp-client.description')}
              </FieldLabel>
              <FieldContent>
                <Input
                  className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={localeService.t('settings-ui.mcp-client.placeholder-description')}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          {isMarketplaceMode
            ? (
              <div className={cn('tm:rounded-2xl tm:border tm:border-line/70 tm:bg-black/10 tm:p-4')}>
                <SectionHeader
                  icon={selectedInstallOption?.transport === 'http' ? Globe : TerminalSquare}
                  title={localeService.t('settings-ui.mcp-client.installation-method')}
                />

                <FieldGroup className="tm:gap-4">
                  {registryItem.installOptions.length > 1 && (
                    <Field>
                      <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                        {localeService.t('settings-ui.mcp-client.installation-method')}
                      </FieldLabel>
                      <FieldContent>
                        <Select
                          value={selectedInstallOption?.id}
                          onValueChange={(value) => {
                            const option = registryItem.installOptions.find((item) => item.id === value);
                            setSelectedInstallOptionId(value);
                            setParameterValues(buildInitialParameters(option?.inputs ?? []));
                            setForm((prev) => ({
                              ...prev,
                              transport: option?.transport ?? prev.transport,
                              remoteProtocol: option?.config.type === 'http' ? option.config.protocol : prev.remoteProtocol,
                            }));
                          }}
                        >
                          <SelectTrigger className="tm:h-9 tm:border-line/70 tm:bg-one-bg/65 tm:px-3 tm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {registryItem.installOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedInstallOption?.description && (
                          <FieldDescription className="tm:text-xs">
                            {selectedInstallOption.description}
                          </FieldDescription>
                        )}
                      </FieldContent>
                    </Field>
                  )}

                  {!!selectedInstallOption?.prerequisites.length && (
                    <Field>
                      <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                        {localeService.t('settings-ui.mcp-client.prerequisites')}
                      </FieldLabel>
                      <FieldContent>
                        <div className="tm:flex tm:flex-wrap tm:gap-1.5">
                          {selectedInstallOption.prerequisites.map((item) => (
                            <Badge key={item} variant="secondary" className="tm:bg-one-bg2 tm:text-[10px]">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </FieldContent>
                    </Field>
                  )}

                  {registryRequiredInputs.length > 0 && (
                    <div className="tm:flex tm:flex-col tm:gap-3">
                      <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                        {localeService.t('settings-ui.mcp-client.required-parameters')}
                      </FieldLabel>
                      {registryRequiredInputs.map((input) => (
                        <Field key={input.key}>
                          <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                            {input.name}
                            {' '}
                            *
                          </FieldLabel>
                          <FieldContent>
                            <Input
                              className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                              type={input.secret ? 'password' : 'text'}
                              value={parameterValues[input.key] ?? ''}
                              onChange={(event) => setParameterValues((prev) => ({ ...prev, [input.key]: event.target.value }))}
                              placeholder={input.placeholder}
                            />
                            {input.description && (
                              <FieldDescription className="tm:text-xs">
                                {input.description}
                              </FieldDescription>
                            )}
                          </FieldContent>
                        </Field>
                      ))}
                    </div>
                  )}

                  {registryOptionalInputs.length > 0 && (
                    <div className="tm:flex tm:flex-col tm:gap-3">
                      <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                        {localeService.t('settings-ui.mcp-client.optional-parameters')}
                      </FieldLabel>
                      {registryOptionalInputs.map((input) => (
                        <Field key={input.key}>
                          <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                            {input.name}
                          </FieldLabel>
                          <FieldContent>
                            <Input
                              className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                              type={input.secret ? 'password' : 'text'}
                              value={parameterValues[input.key] ?? ''}
                              onChange={(event) => setParameterValues((prev) => ({ ...prev, [input.key]: event.target.value }))}
                              placeholder={input.placeholder}
                            />
                            {input.description && (
                              <FieldDescription className="tm:text-xs">
                                {input.description}
                              </FieldDescription>
                            )}
                          </FieldContent>
                        </Field>
                      ))}
                    </div>
                  )}

                  {generatedRegistryConfig && (
                    <div className="tm:rounded-xl tm:border tm:border-line/70 tm:bg-one-bg/55 tm:p-3">
                      <p className="tm:text-xs tm:font-medium tm:text-white">
                        {localeService.t('settings-ui.mcp-client.generated-config')}
                      </p>
                      {generatedRegistryConfig.type === 'stdio'
                        ? (
                          <div className="tm:mt-2 tm:flex tm:flex-col tm:gap-2 tm:text-[11px] tm:text-light-grey">
                            <p>
                              <span className="tm:text-white">{localeService.t('settings-ui.mcp-client.command')}</span>
                              {': '}
                              {generatedRegistryConfig.command}
                            </p>
                            {!!generatedRegistryConfig.args?.length && (
                              <p>
                                <span className="tm:text-white">{localeService.t('settings-ui.mcp-client.arguments')}</span>
                                {': '}
                                {generatedRegistryConfig.args.join(' ')}
                              </p>
                            )}
                            {!!generatedRegistryConfig.env && (
                              <pre
                                className="
                                  tm:overflow-x-auto tm:rounded-lg tm:bg-black/20 tm:p-2 tm:text-[10px]
                                  tm:text-light-grey
                                "
                              >
                                {stringifyKeyValueLines(generatedRegistryConfig.env)}
                              </pre>
                            )}
                          </div>
                        )
                        : (
                          <div className="tm:mt-2 tm:flex tm:flex-col tm:gap-2 tm:text-[11px] tm:text-light-grey">
                            <p>
                              <span className="tm:text-white">{localeService.t('settings-ui.mcp-client.url')}</span>
                              {': '}
                              {generatedRegistryConfig.url}
                            </p>
                            <p>
                              <span className="tm:text-white">{localeService.t('settings-ui.mcp-client.protocol')}</span>
                              {': '}
                              {generatedRegistryConfig.protocol}
                            </p>
                            {!!generatedRegistryConfig.headers && (
                              <pre
                                className="
                                  tm:overflow-x-auto tm:rounded-lg tm:bg-black/20 tm:p-2 tm:text-[10px]
                                  tm:text-light-grey
                                "
                              >
                                {stringifyKeyValueLines(generatedRegistryConfig.headers)}
                              </pre>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </FieldGroup>
              </div>
            )
            : (
              <Tabs
                value={form.transport}
                onValueChange={(value) => value && setForm((prev) => ({ ...prev, transport: value as McpTransportType }))}
                className={cn('tm:gap-2')}
              >
                <Field>
                  <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                    {localeService.t('settings-ui.mcp-client.transport')}
                  </FieldLabel>
                  <FieldContent>
                    <TabsList
                      className={cn(`
                        tm:grid tm:h-auto tm:w-full tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg tm:p-1
                      `, {
                        'tm:grid-cols-2': showStdioOption && showHttpOption,
                        'tm:grid-cols-1': showStdioOption !== showHttpOption,
                      })}
                    >
                      {showStdioOption && (
                        <TabsTrigger
                          value="stdio"
                          className={cn(`
                            tm:justify-center tm:gap-2 tm:rounded-xl tm:border tm:border-transparent tm:px-1
                            tm:text-[12px] tm:font-semibold tm:text-white
                            tm:data-[state=active]:border-blue/35 tm:data-[state=active]:bg-blue/15
                            tm:data-[state=active]:shadow-none
                          `)}
                        >
                          <TerminalSquare className="tm:size-4" />
                          {localeService.t('settings-ui.mcp-client.transport-stdio')}
                        </TabsTrigger>
                      )}

                      {showHttpOption && (
                        <TabsTrigger
                          value="http"
                          className={cn(`
                            tm:justify-center tm:gap-2 tm:rounded-xl tm:border tm:border-transparent tm:px-1
                            tm:text-[12px] tm:font-semibold tm:text-white
                            tm:data-[state=active]:border-blue/35 tm:data-[state=active]:bg-blue/15
                            tm:data-[state=active]:shadow-none
                          `)}
                        >
                          <Globe className="tm:size-4" />
                          {localeService.t('settings-ui.mcp-client.transport-remote')}
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </FieldContent>
                </Field>

                <TabsContent value="stdio" className="tm:m-0">
                  <div className={cn('tm:rounded-2xl tm:border tm:border-line/70 tm:bg-black/10 tm:p-4')}>
                    <SectionHeader
                      icon={TerminalSquare}
                      title={localeService.t('settings-ui.mcp-client.command-configuration')}
                    />

                    <FieldGroup className="tm:gap-4">
                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.command')}
                        </FieldLabel>
                        <FieldContent>
                          <Input
                            className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                            value={form.command}
                            onChange={(event) => setForm((prev) => ({ ...prev, command: event.target.value }))}
                            placeholder={localeService.t('settings-ui.mcp-client.placeholder-command')}
                          />
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.command-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.arguments')}
                        </FieldLabel>
                        <FieldContent>
                          <Input
                            className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                            value={form.args}
                            onChange={(event) => setForm((prev) => ({ ...prev, args: event.target.value }))}
                            placeholder={localeService.t('settings-ui.mcp-client.placeholder-arguments')}
                          />
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.arguments-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.environment')}
                        </FieldLabel>
                        <FieldContent>
                          <Textarea
                            className={cn('tm:min-h-22 tm:p-2 tm:text-xs')}
                            value={form.env}
                            onChange={(event) => setForm((prev) => ({ ...prev, env: event.target.value }))}
                            placeholder={localeService.t('settings-ui.mcp-client.placeholder-environment')}
                          />
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.environment-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                  </div>
                </TabsContent>

                <TabsContent value="http" className="tm:m-0">
                  <div className={cn('tm:rounded-2xl tm:border tm:border-line/70 tm:bg-black/10 tm:p-4')}>
                    <SectionHeader
                      icon={Globe}
                      title={localeService.t('settings-ui.mcp-client.remote-configuration')}
                    />

                    <FieldGroup className="tm:gap-4">
                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.url')}
                        </FieldLabel>
                        <FieldContent>
                          <Input
                            className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                            value={form.url}
                            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                            placeholder={localeService.t('settings-ui.mcp-client.placeholder-url')}
                          />
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.url-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.protocol')}
                        </FieldLabel>
                        <FieldContent>
                          <Tabs
                            value={form.remoteProtocol}
                            onValueChange={(value) => value && setForm((prev) => ({ ...prev, remoteProtocol: value as McpRemoteProtocol }))}
                            className="tm:gap-3"
                          >
                            <TabsList
                              className={cn(`
                                tm:grid tm:h-auto tm:w-full tm:grid-cols-2 tm:rounded-2xl tm:border tm:border-line
                                tm:bg-one-bg tm:p-1
                              `)}
                            >
                              <TabsTrigger
                                value="streamable-http"
                                className={cn(`
                                  tm:justify-center tm:gap-2 tm:rounded-xl tm:border tm:border-transparent tm:px-1
                                  tm:text-[12px] tm:font-semibold tm:text-white
                                  tm:data-[state=active]:border-blue/35 tm:data-[state=active]:bg-blue/15
                                  tm:data-[state=active]:shadow-none
                                `)}
                              >
                                <Network className="tm:size-4" />
                                {localeService.t('settings-ui.mcp-client.protocol-streamable-http')}
                              </TabsTrigger>

                              <TabsTrigger
                                value="sse"
                                className={cn(`
                                  tm:justify-center tm:gap-2 tm:rounded-xl tm:border tm:border-transparent tm:px-1
                                  tm:text-[12px] tm:font-semibold tm:text-white
                                  tm:data-[state=active]:border-blue/35 tm:data-[state=active]:bg-blue/15
                                  tm:data-[state=active]:shadow-none
                                `)}
                              >
                                <Network className="tm:size-4" />
                                {localeService.t('settings-ui.mcp-client.protocol-sse')}
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.protocol-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
                          {localeService.t('settings-ui.mcp-client.headers')}
                        </FieldLabel>
                        <FieldContent>
                          <Textarea
                            className={cn('tm:min-h-22 tm:p-2 tm:text-xs')}
                            value={form.headers}
                            onChange={(event) => setForm((prev) => ({ ...prev, headers: event.target.value }))}
                            placeholder={localeService.t('settings-ui.mcp-client.placeholder-headers')}
                          />
                          <FieldDescription className="tm:text-xs">
                            {localeService.t('settings-ui.mcp-client.headers-description')}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                  </div>
                </TabsContent>
              </Tabs>
            )}
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            {localeService.t('settings-ui.mcp-client.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit || saving}
            onClick={() => void handleSubmit()}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
