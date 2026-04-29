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

import type { IToolPart } from '@termlnk/agent';
import { useDependency } from '@termlnk/design';
import { memo, useMemo } from 'react';
import { IGenerativeUIRegistryService } from '../../../services/generative-ui/generative-ui-registry.service';

interface IGenerativeUiBlockProps {
  part: IToolPart;
}

function extractToolInput(part: IToolPart): Record<string, unknown> {
  if (part.input && typeof part.input === 'object') {
    return part.input;
  }
  return {};
}

function isToolStreaming(part: IToolPart): boolean {
  return part.state !== 'output-available' && part.state !== 'output-error';
}

export const GenerativeUiBlock = memo(function GenerativeUiBlock({ part }: IGenerativeUiBlockProps) {
  const registry = useDependency(IGenerativeUIRegistryService);
  const def = useMemo(() => registry.get(part.toolName), [registry, part.toolName]);
  const input = useMemo(() => extractToolInput(part), [part]);
  const streaming = isToolStreaming(part);

  if (!def) {
    return null;
  }
  const Component = def.render;
  return (
    <div className="tm:my-2" data-testid={`generative-ui-${part.toolName}`}>
      <Component {...input} isStreaming={streaming} />
    </div>
  );
});
