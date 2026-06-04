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

import type { IPublicSshKey, SshKeyAlgorithm, SshKeyCipher } from '@termlnk/terminal';
import type { KeyDialogMode } from '../../services/keychain/keychain-dialog.service';
import { LocaleService } from '@termlnk/core';
import { Button, DialogContent, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogPrimitive, DialogTitle, Field, FieldContent, FieldLabel, Input, Switch, Textarea, ToggleGroup, ToggleGroupItem, useDependency } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

interface IKeyDialogProps {
  mode: KeyDialogMode;
  editKey?: IPublicSshKey;
  onClose: () => void;
}

const ECDSA_BITS = [256, 384, 521];
// RSA: strongest first so it becomes the default when switching algorithm.
// 1024 is weak/legacy but offered for old-device compatibility.
const RSA_BITS = [4096, 2048, 1024];

function getBitOptions(algorithm: SshKeyAlgorithm): number[] {
  if (algorithm === 'ecdsa') {
    return ECDSA_BITS;
  }
  if (algorithm === 'rsa') {
    return RSA_BITS;
  }
  return [];
}

// Parse the free-typed rounds field at submit, falling back to the default.
function clampRounds(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(1000, n)) : 16;
}

const dialogContentCls = `
  tm:w-[min(34rem,calc(100%-2rem))] tm:gap-4 tm:rounded-xl tm:border-line tm:bg-one-bg tm:p-5
  tm:shadow-[0_18px_52px_rgb(0_0_0/0.45)]
`;

export function KeyDialog({ mode, editKey, onClose }: IKeyDialogProps) {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const [label, setLabel] = useState(editKey?.label ?? '');
  const [algorithm, setAlgorithm] = useState<SshKeyAlgorithm>(editKey?.algorithm ?? 'ed25519');
  const [bits, setBits] = useState<number>(4096);
  const [privateKey, setPrivateKey] = useState('');
  const [certificate, setCertificate] = useState(editKey?.certificate ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [cipher, setCipher] = useState<SshKeyCipher>('aes256-ctr');
  const [rounds, setRounds] = useState('16');
  const [savePassphrase, setSavePassphrase] = useState(editKey?.savePassphrase ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const bitOptions = useMemo(() => getBitOptions(algorithm), [algorithm]);

  const handleAlgorithmChange = useCallback((next: SshKeyAlgorithm) => {
    setAlgorithm(next);
    // Keep bits valid for the new algorithm; ed25519 has none.
    const options = getBitOptions(next);
    if (options.length > 0 && !options.includes(bits)) {
      setBits(options[0]);
    }
  }, [bits]);

  const handleSubmit = useCallback(async () => {
    if (!label.trim()) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mode === 'generate') {
        await keychain.generateKey({
          label: label.trim(),
          algorithm,
          bits: bitOptions.length > 0 ? bits : undefined,
          passphrase: passphrase || undefined,
          savePassphrase,
          cipher: passphrase ? cipher : undefined,
          rounds: passphrase ? clampRounds(rounds) : undefined,
        });
      } else if (mode === 'new') {
        await keychain.importKey({
          label: label.trim(),
          privateKey,
          passphrase: passphrase || undefined,
          savePassphrase,
          certificate: certificate || undefined,
        });
      } else if (editKey) {
        await keychain.updateKey({
          id: editKey.id,
          label: label.trim(),
          certificate: certificate || undefined,
          passphrase: passphrase || undefined,
          savePassphrase,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [mode, editKey, keychain, label, algorithm, bits, bitOptions, privateKey, certificate, passphrase, cipher, rounds, savePassphrase, onClose]);

  const titleKey = mode === 'generate'
    ? 'terminal-ui.keychain.key.generateTitle'
    : mode === 'new'
      ? 'terminal-ui.keychain.key.newKeyTitle'
      : 'terminal-ui.keychain.key.editTitle';
  const canSubmit = !!label.trim() && (mode !== 'new' || !!privateKey.trim());

  return (
    <DialogPrimitive open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="tm:bg-darker-black/70 tm:backdrop-blur-[1.5px]" />
        <DialogContent
          closable={false}
          className={dialogContentCls}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle className="tm:text-[15px] tm:font-semibold tm:text-white">{t(titleKey)}</DialogTitle>
          </DialogHeader>

          <Field>
            <FieldLabel>{t('terminal-ui.keychain.field.label')}</FieldLabel>
            <FieldContent>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="prod-key" />
            </FieldContent>
          </Field>

          {mode === 'edit' && editKey && (
            <>
              <Field>
                <FieldLabel>{t('terminal-ui.keychain.field.publicKey')}</FieldLabel>
                <FieldContent>
                  <CopyableSecret value={editKey.publicKey} />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>{t('terminal-ui.keychain.field.privateKey')}</FieldLabel>
                <FieldContent>
                  <RevealablePrivateKey load={() => keychain.revealPrivateKey(editKey.id)} />
                </FieldContent>
              </Field>
            </>
          )}

          {mode === 'generate' && (
            <>
              <Field>
                <FieldLabel>{t('terminal-ui.keychain.field.algorithm')}</FieldLabel>
                <FieldContent>
                  <SegmentedToggle
                    value={algorithm}
                    options={[
                      { value: 'ed25519', label: 'ED25519' },
                      { value: 'ecdsa', label: 'ECDSA' },
                      { value: 'rsa', label: 'RSA' },
                    ]}
                    onValueChange={(v) => handleAlgorithmChange(v as SshKeyAlgorithm)}
                  />
                </FieldContent>
              </Field>
              {bitOptions.length > 0 && (
                <Field>
                  <FieldLabel>{t('terminal-ui.keychain.field.bits')}</FieldLabel>
                  <FieldContent>
                    <SegmentedToggle
                      value={String(bits)}
                      options={bitOptions.map((b) => ({ value: String(b), label: String(b) }))}
                      onValueChange={(v) => setBits(Number(v))}
                    />
                  </FieldContent>
                </Field>
              )}
            </>
          )}

          {mode === 'new' && (
            <Field>
              <FieldLabel>{t('terminal-ui.keychain.field.privateKey')}</FieldLabel>
              <FieldContent>
                <Textarea
                  className="tm:min-h-28 tm:font-mono tm:text-[12px]"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                />
              </FieldContent>
            </Field>
          )}

          {mode !== 'edit' && (
            <Field>
              <FieldLabel>{t('terminal-ui.keychain.field.passphrase')}</FieldLabel>
              <FieldContent>
                <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
              </FieldContent>
            </Field>
          )}

          {mode === 'generate' && passphrase.trim() !== '' && (
            <>
              <Field>
                <FieldLabel>{t('terminal-ui.keychain.field.cipher')}</FieldLabel>
                <FieldContent>
                  <SegmentedToggle
                    value={cipher}
                    options={[
                      { value: 'aes256-ctr', label: 'AES-256' },
                      { value: 'aes128-ctr', label: 'AES-128' },
                      { value: '3des-cbc', label: '3DES' },
                    ]}
                    onValueChange={(v) => setCipher(v as SshKeyCipher)}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>{t('terminal-ui.keychain.field.rounds')}</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                  />
                  <p className="tm:mt-1 tm:text-[11px] tm:text-grey-fg">{t('terminal-ui.keychain.field.roundsHelp')}</p>
                </FieldContent>
              </Field>
            </>
          )}

          <label className="tm:flex tm:items-center tm:gap-2 tm:text-[12px] tm:text-grey-fg2">
            <Switch checked={savePassphrase} onCheckedChange={setSavePassphrase} />
            {t('terminal-ui.keychain.field.savePassphrase')}
          </label>

          <Field>
            <FieldLabel>{t('terminal-ui.keychain.field.certificate')}</FieldLabel>
            <FieldContent>
              <Textarea
                className="tm:font-mono tm:text-[12px]"
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                placeholder="ssh-ed25519-cert-v01@openssh.com ..."
              />
            </FieldContent>
          </Field>

          {error && <div className="tm:text-[12px] tm:text-red">{error}</div>}

          <DialogFooter className="tm:gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('terminal-ui.keychain.action.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit || busy}>
              {t('terminal-ui.keychain.action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </DialogPrimitive>
  );
}

interface ISegmentedToggleProps {
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}

function SegmentedToggle({ value, options, onValueChange }: ISegmentedToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      spacing={2}
      // Ignore empty value so a segment is always selected.
      onValueChange={(next) => next && onValueChange(next)}
      className="tm:w-full tm:border tm:border-line tm:bg-one-bg3 tm:p-0.5"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          size="sm"
          className={`
            tm:h-8 tm:flex-1 tm:rounded-md tm:text-[12px] tm:text-grey-fg2
            tm:hover:bg-one-bg2 tm:hover:text-light-grey
            tm:data-[state=on]:bg-blue tm:data-[state=on]:text-white
          `}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const secretBoxCls = `
  tm:max-h-32 tm:min-h-9 tm:flex-1 tm:overflow-auto tm:rounded-md tm:border tm:border-line tm:bg-one-bg3 tm:px-2.5
  tm:py-1.5 tm:font-mono tm:text-[11px] tm:break-all tm:whitespace-pre-wrap tm:text-light-grey
`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(setCopied, 1200, false);
    }).catch(() => {});
  }, [value]);

  return (
    <Button variant="ghost" size="icon-sm" onClick={copy}>
      {copied ? <Check size={14} className="tm:text-green" /> : <Copy size={14} />}
    </Button>
  );
}

function CopyableSecret({ value }: { value: string }) {
  return (
    <div className="tm:flex tm:items-start tm:gap-1.5">
      <div className={secretBoxCls}>{value}</div>
      <CopyButton value={value} />
    </div>
  );
}

function RevealablePrivateKey({ load }: { load: () => Promise<string | undefined> }) {
  const localeService = useDependency(LocaleService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);
  const [value, setValue] = useState<string | null>(null);

  const reveal = useCallback(() => {
    load().then((pem) => setValue(pem ?? '')).catch(() => setValue(''));
  }, [load]);

  if (value === null) {
    return (
      <Button variant="outline" size="sm" className="tm:h-9 tm:gap-1.5" onClick={reveal}>
        <Eye size={14} />
        {t('terminal-ui.keychain.action.reveal')}
      </Button>
    );
  }

  return (
    <div className="tm:flex tm:items-start tm:gap-1.5">
      <div className={secretBoxCls}>{value}</div>
      <div className="tm:flex tm:flex-col tm:gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => setValue(null)}>
          <EyeOff size={14} />
        </Button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
