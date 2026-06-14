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

import type { SshKeyAlgorithm, SshKeyCipher } from '@termlnk/terminal';
import type { KeyDialogMode } from '../../services/keychain/keychain-dialog.service';
import { LocaleService } from '@termlnk/core';
import { Button, Field, FieldContent, FieldLabel, Input, Switch, Textarea, ToggleGroup, ToggleGroupItem, useDependency, useObservable } from '@termlnk/design';
import { IKeychainManagerService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IKeychainDialogService } from '../../services/keychain/keychain-dialog.service';

const ECDSA_BITS = [256, 384, 521];
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

function clampRounds(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(1000, n)) : 16;
}

export function KeyDialog() {
  const localeService = useDependency(LocaleService);
  const keychain = useDependency(IKeychainManagerService);
  const keychainDialog = useDependency(IKeychainDialogService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const dialogState = useObservable(keychainDialog.state$, keychainDialog.getState());
  const mode: KeyDialogMode = dialogState.key?.mode ?? 'generate';
  const editKey = dialogState.key?.key;

  const [label, setLabel] = useState('');
  const [algorithm, setAlgorithm] = useState<SshKeyAlgorithm>('ed25519');
  const [bits, setBits] = useState<number>(4096);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [certificate, setCertificate] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [cipher, setCipher] = useState<SshKeyCipher>('aes256-ctr');
  const [rounds, setRounds] = useState('16');
  const [savePassphrase, setSavePassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetKey = dialogState.key
    ? `${mode}:${editKey?.id ?? ''}`
    : '';
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKeyRef.current) {
      return;
    }
    prevResetKeyRef.current = resetKey;

    setError('');
    setBusy(false);
    setPassphrase('');
    setPrivateKey('');
    setCipher('aes256-ctr');
    setRounds('16');

    if (!dialogState.key) {
      setLabel('');
      setAlgorithm('ed25519');
      setBits(4096);
      setPublicKey('');
      setCertificate('');
      setSavePassphrase(false);
      return;
    }
    if (editKey) {
      setLabel(editKey.label);
      setAlgorithm(editKey.algorithm);
      setPublicKey(editKey.publicKey ?? '');
      setCertificate(editKey.certificate ?? '');
      setSavePassphrase(editKey.savePassphrase ?? false);
    } else {
      setLabel('');
      setAlgorithm('ed25519');
      setBits(4096);
      setPublicKey('');
      setCertificate('');
      setSavePassphrase(false);
    }
  }, [resetKey, dialogState.key, editKey, mode]);

  useEffect(() => {
    if (mode !== 'edit' || !editKey) {
      return;
    }
    let active = true;
    keychain.revealPrivateKey(editKey.id)
      .then((pem) => {
        if (active) {
          setPrivateKey(pem ?? '');
        }
      })
      .catch(() => {
        if (active) {
          setPrivateKey('');
        }
      });
    return () => {
      active = false;
    };
  }, [keychain, editKey, mode]);

  const bitOptions = useMemo(() => getBitOptions(algorithm), [algorithm]);

  const handleAlgorithmChange = useCallback((next: SshKeyAlgorithm) => {
    setAlgorithm(next);
    const options = getBitOptions(next);
    if (options.length > 0 && !options.includes(bits)) {
      setBits(options[0]);
    }
  }, [bits]);

  const handleClose = useCallback(() => {
    keychainDialog.close();
  }, [keychainDialog]);

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
          publicKey,
          privateKey,
          certificate: certificate || undefined,
          passphrase: passphrase || undefined,
          savePassphrase,
        });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [mode, editKey, keychain, label, algorithm, bits, bitOptions, publicKey, privateKey, certificate, passphrase, cipher, rounds, savePassphrase, handleClose]);

  const canSubmit = !!label.trim() && (mode === 'generate' || !!privateKey.trim());

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      <Field>
        <FieldLabel>{t('terminal-ui.keychain.field.label')}</FieldLabel>
        <FieldContent>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="prod-key" />
        </FieldContent>
      </Field>

      {mode === 'edit' && editKey && (
        <>
          <Field>
            <FieldLabel>{t('terminal-ui.keychain.field.privateKey')}</FieldLabel>
            <FieldContent>
              <Textarea
                className="tm:min-h-28 tm:font-mono tm:text-[12px]"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{t('terminal-ui.keychain.field.publicKey')}</FieldLabel>
            <FieldContent>
              <Textarea
                className="tm:min-h-28 tm:font-mono tm:text-[12px]"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
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

      <div className="tm:flex tm:justify-end tm:gap-2 tm:pt-1">
        <Button variant="outline" size="sm" onClick={handleClose}>{t('terminal-ui.keychain.action.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit || busy}>
          {t('terminal-ui.keychain.action.save')}
        </Button>
      </div>
    </div>
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
