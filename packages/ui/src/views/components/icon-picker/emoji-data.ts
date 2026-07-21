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

import type { EmojiMartData } from '@emoji-mart/data';
import emojiDataJson from '@emoji-mart/data/sets/15/native.json';
import { init, SearchIndex } from 'emoji-mart';

export interface IEmojiGridEntry {
  id: string;
  native: string;
}

interface ISearchedEmoji {
  id: string;
  skins: Array<{ native: string }>;
}

const emojiData = emojiDataJson as unknown as EmojiMartData;

// Flatten all emojis in category order once at module load; the grid renders this
// static list while no search query is active. Built before init() runs — init
// mutates the dataset (unshifts an empty "frequent" category).
export const ALL_EMOJIS: IEmojiGridEntry[] = emojiData.categories.flatMap((category) =>
  category.emojis.flatMap((emojiId) => {
    const emoji = emojiData.emojis[emojiId];
    const native = emoji?.skins[0]?.native;
    return emoji && native ? [{ id: emoji.id, native }] : [];
  })
);

let emojiSearchInitPromise: Promise<unknown> | null = null;

/**
 * Hand the bundled dataset to emoji-mart so SearchIndex builds its index offline
 * (without init it lazily fetches the dataset from a CDN).
 */
function ensureEmojiSearchReady(): Promise<unknown> {
  if (!emojiSearchInitPromise) {
    emojiSearchInitPromise = init({ data: emojiData });
  }
  return emojiSearchInitPromise;
}

/** Keyword search over the bundled emoji dataset; resolves to an empty list on no match. */
export async function searchEmojis(query: string): Promise<IEmojiGridEntry[]> {
  await ensureEmojiSearchReady();
  const emojis = (await SearchIndex.search(query)) as ISearchedEmoji[] | null;
  return (emojis ?? [])
    .map((emoji) => ({ id: emoji.id, native: emoji.skins[0]?.native ?? '' }))
    .filter((entry) => entry.native.length > 0);
}
