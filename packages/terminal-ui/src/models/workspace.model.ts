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

import type { IIconPickerValue } from '@termlnk/ui';
import type { TerminalSessionStatus } from '../services/terminal/terminal-ui.service';

// Layout direction
export type WorkspaceLayoutDirection = 'horizontal' | 'vertical';

// Drop side (9-zone detection)
export type DropSide = 'left' | 'right' | 'top' | 'bottom'
  | 'outer-left' | 'outer-right' | 'outer-top' | 'outer-bottom'
  | 'center';

// Leaf node: single session pane
export interface IWorkspaceLayoutLeaf {
  type: 'leaf';
  sessionId: string;
}

// Branch node: split container
export interface IWorkspaceLayoutBranch {
  type: 'branch';
  direction: WorkspaceLayoutDirection;
  children: IWorkspaceLayoutNode[];
  sizes: number[]; // percentages, parallel with children
}

export type IWorkspaceLayoutNode = IWorkspaceLayoutLeaf | IWorkspaceLayoutBranch;

// Workspace entity
export interface IWorkspace {
  id: string;
  name: string;
  layout: IWorkspaceLayoutNode;
  activeSessionId: string | null;
  /** Custom tab icon; undefined renders the default LayoutGrid glyph. */
  icon?: IIconPickerValue;
  /** Pinned tabs collapse to an icon-only chip locked to the front of the tab bar. */
  pinned?: boolean;
}

// Tab item union types for tab bar rendering
export interface ISingleSessionTabItem {
  type: 'session';
  sessionId: string;
}

export interface IWorkspaceTabItem {
  type: 'workspace';
  workspaceId: string;
}

export type ITabItem = ISingleSessionTabItem | IWorkspaceTabItem;

// Magnify state
export interface IMagnifyState {
  workspaceId: string;
  sessionId: string;
}

// Pane-to-tab drag state (workspace pane → tab bar extraction)
export interface IPaneToTabDragState {
  sessionId: string;
  workspaceId: string;
  dropIndex: number;
}

/**
 * Tab-bar projection of a workspace — the only fields tab rendering depends on.
 * Subscribing to this instead of the full `IWorkspace` keeps splitter-drag layout
 * mutations from re-rendering the tab bar.
 */
export type IWorkspaceTabMeta = Pick<IWorkspace, 'id' | 'name' | 'icon' | 'pinned'>;

// Tab bar display item (unified rendering interface)
export interface ITabDisplayItem {
  id: string;
  tabType: 'session' | 'workspace';
  label: string;
  sessionType?: string;
  sessionStatus?: TerminalSessionStatus;
  sessionCount?: number;
  icon?: IIconPickerValue;
  pinned?: boolean;
}
