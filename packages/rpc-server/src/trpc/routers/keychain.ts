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

import { HostRepository, IdentityRepository, KnownHostRepository, SshKeyRepository } from '@termlnk/database';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { sanitizeIdentities, sanitizeIdentity, sanitizeSshKey, sanitizeSshKeys } from '../../common/sanitize-secrets';
import { ISshKeygenService } from '../../services/keychain/ssh-keygen.service';
import { createIdentitySchema, generateKeySchema, importKeySchema, updateIdentitySchema, updateSshKeySchema } from '../schema/keychain.schema';
import { publicProcedure, router } from '../trpc';

export type KeychainRouter = typeof keychainRouter;

export const keychainRouter = router({
  // --- SSH keys ---------------------------------------------------------------
  listKeys: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(SshKeyRepository);
    return sanitizeSshKeys(await repo.getList());
  }),
  getKey: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(SshKeyRepository);
    const key = await repo.getById(input);
    return key ? sanitizeSshKey(key) : undefined;
  }),
  // Returns the decrypted private-key PEM for user inspection/copy. This is the
  // one path that exposes a secret to the renderer; gated to explicit reveal.
  revealPrivateKey: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(SshKeyRepository);
    const key = await repo.getById(input);
    return key?.privateKey;
  }),
  generateKey: publicProcedure.input(generateKeySchema).mutation(async ({ input, ctx }) => {
    const keygen = ctx.injector.get(ISshKeygenService);
    const material = keygen.generate({
      algorithm: input.algorithm,
      bits: input.bits,
      comment: input.label,
      passphrase: input.passphrase,
      cipher: input.cipher,
      rounds: input.rounds,
    });
    const repo = ctx.injector.get(SshKeyRepository);
    return repo.create({
      label: input.label,
      algorithm: material.algorithm,
      bits: material.bits ?? null,
      privateKey: material.privateKey,
      publicKey: material.publicKey,
      passphrase: input.savePassphrase ? (input.passphrase ?? null) : null,
      savePassphrase: input.savePassphrase ?? false,
      source: 'generated',
      publicKeyFingerprint: material.fingerprint,
    });
  }),
  importKey: publicProcedure.input(importKeySchema).mutation(async ({ input, ctx }) => {
    const keygen = ctx.injector.get(ISshKeygenService);
    const material = keygen.parseImported(input.privateKey, input.passphrase);
    const repo = ctx.injector.get(SshKeyRepository);
    return repo.create({
      label: input.label,
      algorithm: material.algorithm,
      bits: material.bits ?? null,
      privateKey: material.privateKey,
      publicKey: material.publicKey,
      certificate: input.certificate ?? null,
      passphrase: input.savePassphrase ? (input.passphrase ?? null) : null,
      savePassphrase: input.savePassphrase ?? false,
      source: 'imported',
      publicKeyFingerprint: material.fingerprint,
    });
  }),
  updateKey: publicProcedure.input(updateSshKeySchema).mutation(async ({ input, ctx }) => {
    const { id, ...updates } = input;
    const repo = ctx.injector.get(SshKeyRepository);
    return repo.update(id, updates);
  }),
  getKeyReferrers: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const hosts = await ctx.injector.get(HostRepository).findByCredentialRef('key', input);
    const identities = await ctx.injector.get(IdentityRepository).getReferrersByKeyId(input);
    return {
      hosts: hosts.map((h) => ({ id: h.id, label: h.label })),
      identities: identities.map((i) => ({ id: i.id, label: i.label })),
    };
  }),
  // Blocks when a host still references the key; nulls out identity references first.
  deleteKey: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const hostRefs = await ctx.injector.get(HostRepository).findByCredentialRef('key', input);
    if (hostRefs.length > 0) {
      throw new Error(`Key is referenced by ${hostRefs.length} host(s) and cannot be deleted`);
    }
    const identityRepo = ctx.injector.get(IdentityRepository);
    const identityRefs = await identityRepo.getReferrersByKeyId(input);
    for (const identity of identityRefs) {
      await identityRepo.update(identity.id, { keyId: null });
    }
    return ctx.injector.get(SshKeyRepository).delete(input);
  }),
  onKeysChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(SshKeyRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),

  // --- Identities -------------------------------------------------------------
  listIdentities: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(IdentityRepository);
    return sanitizeIdentities(await repo.getList());
  }),
  getIdentity: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(IdentityRepository);
    const identity = await repo.getById(input);
    return identity ? sanitizeIdentity(identity) : undefined;
  }),
  createIdentity: publicProcedure.input(createIdentitySchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(IdentityRepository);
    return repo.create({
      label: input.label,
      username: input.username,
      password: input.password ?? null,
      keyId: input.keyId ?? null,
    });
  }),
  updateIdentity: publicProcedure.input(updateIdentitySchema).mutation(async ({ input, ctx }) => {
    const { id, ...updates } = input;
    const repo = ctx.injector.get(IdentityRepository);
    return repo.update(id, updates);
  }),
  getIdentityReferrers: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const hosts = await ctx.injector.get(HostRepository).findByCredentialRef('identity', input);
    return { hosts: hosts.map((h) => ({ id: h.id, label: h.label })) };
  }),
  deleteIdentity: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const hostRefs = await ctx.injector.get(HostRepository).findByCredentialRef('identity', input);
    if (hostRefs.length > 0) {
      throw new Error(`Identity is referenced by ${hostRefs.length} host(s) and cannot be deleted`);
    }
    return ctx.injector.get(IdentityRepository).delete(input);
  }),
  onIdentitiesChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(IdentityRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),

  // --- Known hosts ------------------------------------------------------------
  listKnownHosts: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(KnownHostRepository);
    return repo.getList();
  }),
  deleteKnownHost: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(KnownHostRepository);
    return repo.delete(input);
  }),
  deleteKnownHosts: publicProcedure.input(z.array(z.string())).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(KnownHostRepository);
    return repo.deleteMany(input);
  }),
  onKnownHostsChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(KnownHostRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),
});
