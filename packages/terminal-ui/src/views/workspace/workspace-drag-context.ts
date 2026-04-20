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

import type { DropSide } from '../../models/workspace.model';
import { createContext } from 'react';

export interface IWorkspaceDragState {
  draggedSessionId: string;
  workspaceId: string;
}

export interface IWorkspaceDropTarget {
  targetSessionId: string;
  side: DropSide;
}

export interface IWorkspaceDragContext {
  dragState: IWorkspaceDragState | null;
  setDragState: (state: IWorkspaceDragState | null) => void;
  dragTarget: IWorkspaceDropTarget | null;
  setDragTarget: (target: IWorkspaceDropTarget | null) => void;
  onDrop: (targetSessionId: string, side: DropSide) => void;
}

export const WorkspaceDragContext = createContext<IWorkspaceDragContext>({
  dragState: null,
  setDragState: () => {},
  dragTarget: null,
  setDragTarget: () => {},
  onDrop: () => {},
});
