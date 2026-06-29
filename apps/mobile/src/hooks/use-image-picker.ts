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

import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert } from 'react-native';

export interface IMobileAttachedImage {
  readonly id: string;
  readonly uri: string;
  readonly mimeType: string;
  readonly fileName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useImagePicker() {
  const pickImages = useCallback(async (): Promise<IMobileAttachedImage[]> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return [];
    }

    const attachments: IMobileAttachedImage[] = [];
    for (const asset of result.assets) {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ACCEPTED_TYPES.has(mimeType)) {
        continue;
      }
      if (asset.fileSize != null && asset.fileSize > MAX_FILE_SIZE) {
        continue;
      }

      let uri = asset.uri;
      let resolvedMimeType = mimeType;
      if (HEIC_TYPES.has(mimeType)) {
        const converted = await manipulateAsync(asset.uri, [], {
          format: SaveFormat.JPEG,
          compress: 0.8,
        });
        uri = converted.uri;
        resolvedMimeType = 'image/jpeg';
      }

      attachments.push({
        id: generateId(),
        uri,
        mimeType: resolvedMimeType,
        fileName: asset.fileName ?? 'image',
      });
    }
    return attachments;
  }, []);

  const takePhoto = useCallback(async (): Promise<IMobileAttachedImage | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      id: generateId(),
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? 'photo',
    };
  }, []);

  return { pickImages, takePhoto };
}

export async function readImageAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
