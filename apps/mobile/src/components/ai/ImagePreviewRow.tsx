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

import type { IMobileAttachedImage } from '../../hooks/use-image-picker';
import { X } from 'lucide-react-native';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

interface IImagePreviewRowProps {
  readonly attachments: readonly IMobileAttachedImage[];
  readonly onRemove: (id: string) => void;
}

export function ImagePreviewRow({ attachments, onRemove }: IImagePreviewRowProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 8 }}
    >
      {attachments.map((img) => (
        <View key={img.id} className="relative">
          <Image
            source={{ uri: img.uri }}
            className="h-14 w-14 rounded-xl"
            resizeMode="cover"
          />
          <Pressable
            onPress={() => onRemove(img.id)}
            className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-danger"
          >
            <X size={10} color="#ffffff" />
          </Pressable>
          <Text className="mt-0.5 w-14 text-center text-[9px] text-content-tertiary" numberOfLines={1}>
            {img.fileName}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
