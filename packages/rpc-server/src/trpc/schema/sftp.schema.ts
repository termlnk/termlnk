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

import { z } from 'zod';

export const sftpSessionIdSchema = z.string();

export const sftpCreateSessionSchema = z.object({
  hostId: z.string(),
  password: z.string().optional(),
});

export const sftpRetrySessionSchema = z.object({
  sessionId: sftpSessionIdSchema,
  password: z.string(),
});

export const sftpPathSchema = z.object({
  sessionId: sftpSessionIdSchema,
  path: z.string(),
});

export const sftpRenameSchema = z.object({
  sessionId: sftpSessionIdSchema,
  oldPath: z.string(),
  newPath: z.string(),
});

export const sftpChmodSchema = z.object({
  sessionId: sftpSessionIdSchema,
  path: z.string(),
  mode: z.number(),
});

export const sftpWriteFileSchema = z.object({
  sessionId: sftpSessionIdSchema,
  path: z.string(),
  content: z.string(), // base64
});

export const sftpDownloadSchema = z.object({
  sessionId: sftpSessionIdSchema,
  remotePath: z.string(),
  localPath: z.string(),
});

export const sftpUploadSchema = z.object({
  sessionId: sftpSessionIdSchema,
  localPath: z.string(),
  remotePath: z.string(),
});

export const sftpRespondKeyboardInteractiveSchema = z.object({
  sessionId: sftpSessionIdSchema,
  responses: z.array(z.string()),
});

export const sftpRespondChangePasswordSchema = z.object({
  sessionId: sftpSessionIdSchema,
  newPassword: z.string(),
});

export const sftpUploadDirectorySchema = z.object({
  sessionId: sftpSessionIdSchema,
  localBasePath: z.string(),
  remoteBasePath: z.string(),
  entries: z.array(z.object({
    absolutePath: z.string(),
    relativePath: z.string(),
    isDirectory: z.boolean(),
  })),
});
