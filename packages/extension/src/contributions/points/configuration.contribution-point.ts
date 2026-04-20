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

import type { IExtensionPointDescriptor } from '../../registry/extension-point';
import { z } from 'zod';

export interface IContributedConfigurationProperty {
  type: string;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
}

export interface IContributedConfiguration {
  title?: string;
  properties: Record<string, IContributedConfigurationProperty>;
}

export const contributedConfigPropertySchema: z.ZodType<IContributedConfigurationProperty> = z.object({
  type: z.string(),
  default: z.unknown().optional(),
  description: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  enumDescriptions: z.array(z.string()).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
});

export const contributedConfigurationSchema: z.ZodType<IContributedConfiguration> = z.object({
  title: z.string().optional(),
  properties: z.record(z.string(), contributedConfigPropertySchema),
});

export const ConfigurationContributionPoint: IExtensionPointDescriptor<IContributedConfiguration> = {
  name: 'configuration',
  schema: contributedConfigurationSchema,
};

declare module '../../manifest/contribution-points' {
  interface IExtensionContributesMap {
    configuration: IContributedConfiguration;
  }
}
