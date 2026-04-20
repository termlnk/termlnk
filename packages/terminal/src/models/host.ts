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

export enum HostType {
  UNKNOWN = 'unknown',
  HOST = 'host',
  GROUP = 'group',
}

export interface IHostItemBase {
  id: string;
  pid: string;
  label: string;
  type: HostType;
  sort: number;
}

export interface IHostSettings {
  connectTimeout: number;
  connectHeartbeat: number;
  runScript: string;
  encode: string;
  x11Forward: boolean;
  termType: string;
  fontFamily: string;
  fontSize: number;
}

export interface IHost extends IHostItemBase {
  type: HostType.HOST;
  addr: string;
  port: number;
  credential: ICredential;
  proxy: IProxy;
  settings: IHostSettings;
}

export interface IHostGroup extends IHostItemBase {
  type: HostType.GROUP;
}

export type HostItem = IHost | IHostGroup | IHostItemBase;

export type HostTree = HostItem & { children: HostTree[] };

export type ICredential = IPasswordCredential | IRSACredential | IAlwaysCredential;

export interface IPasswordCredential {
  type: 'password';
  username: string;
  password: string;
}

export interface IRSACredential {
  type: 'rsa';
  username: string;
  privateKey: string;
}

export interface IAlwaysCredential {
  type: 'always';
  username: string;
}

export interface IProxy {
  enabled: boolean;
  type: 'socks5' | 'http';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface IHostSchema {
  id: string;
  pid: string;
  order: number;
}

export interface IHostChangeEvent {
  type: 'add' | 'update' | 'delete' | 'move';
  id: string;
  pid: string;
}
