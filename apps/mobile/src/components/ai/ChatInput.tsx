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

import type { IMobileChatMessage, IMobileSendMessageOptions, MobileAgentStatus, MobileThinkingLevel } from '@termlnk/agent-mobile';
import type { IMobileAttachedImage } from '../../hooks/use-image-picker';
import { ChevronDown, Gauge, Lightbulb, Paperclip, Send, ShieldCheck, Sparkles, Square, Wrench } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { readImageAsBase64, useImagePicker } from '../../hooks/use-image-picker';
import { cn } from '../../lib/cn';
import { useThemeColors } from '../../theme/theme-provider';
import { ImagePreviewRow } from './ImagePreviewRow';
import { PlaceholderSheet } from './PlaceholderSheet';
import { ThinkingLevelSheet } from './ThinkingLevelSheet';
import { ToolbarIconButton } from './ToolbarIconButton';

const THINKING_BADGE: Record<MobileThinkingLevel, string | undefined> = {
  off: undefined,
  minimal: 'MI',
  low: 'L',
  medium: 'M',
  high: 'H',
  xhigh: 'XH',
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

interface IChatInputProps {
  readonly modelName: string | null;
  readonly modelReasoning: boolean;
  readonly contextWindowTokens: number;
  readonly status: MobileAgentStatus;
  readonly messages: readonly IMobileChatMessage[];
  readonly onSend: (text: string, options?: IMobileSendMessageOptions) => void;
  readonly onStop: () => void;
  readonly onModelPress: () => void;
  readonly thinkingLevel: MobileThinkingLevel;
  readonly onThinkingLevelChange: (level: MobileThinkingLevel) => void;
  readonly bottomInset: number;
}

export function ChatInput({
  modelName,
  modelReasoning,
  contextWindowTokens,
  status,
  messages,
  onSend,
  onStop,
  onModelPress,
  thinkingLevel,
  onThinkingLevelChange,
  bottomInset,
}: IChatInputProps) {
  const colors = useThemeColors();
  const { pickImages } = useImagePicker();
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<IMobileAttachedImage[]>([]);

  const [showThinkingSheet, setShowThinkingSheet] = useState(false);
  const [placeholderSheet, setPlaceholderSheet] = useState<{ title: string; description: string; icon: typeof Wrench } | null>(null);

  const isStreaming = status === 'streaming' || status === 'thinking';
  const canSend = !isStreaming && modelName != null && (input.trim().length > 0 || attachedImages.length > 0);

  const draftTokens = useMemo(() => Math.ceil(input.length / 3.8), [input.length]);

  const latestContextTokens = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const totalTokens = messages[i]?.usage?.totalTokens;
      if (typeof totalTokens === 'number' && totalTokens > 0) {
        return totalTokens;
      }
    }
    return 0;
  }, [messages]);

  const contextUsagePercent = useMemo(() => {
    const window = contextWindowTokens > 0 ? contextWindowTokens : DEFAULT_CONTEXT_WINDOW;
    const used = latestContextTokens + draftTokens;
    return Math.max(0, Math.min(100, Math.round((used / window) * 100)));
  }, [latestContextTokens, draftTokens, contextWindowTokens]);

  const handleAttach = useCallback(async () => {
    const images = await pickImages();
    if (images.length > 0) {
      setAttachedImages((prev) => [...prev, ...images]);
    }
  }, [pickImages]);

  const handleRemoveImage = useCallback((id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!canSend) {
      return;
    }

    const options: IMobileSendMessageOptions = {};
    if (attachedImages.length > 0) {
      const images = await Promise.all(
        attachedImages.map(async (img) => ({
          data: await readImageAsBase64(img.uri),
          mimeType: img.mimeType,
        }))
      );
      (options as { images: typeof images }).images = images;
    }

    setInput('');
    setAttachedImages([]);
    onSend(text, options);
  }, [input, canSend, attachedImages, onSend]);

  return (
    <View className="bg-surface px-3 pt-1.5" style={{ paddingBottom: bottomInset + 8 }}>
      <ImagePreviewRow attachments={attachedImages} onRemove={handleRemoveImage} />

      <View className="overflow-hidden rounded-2xl bg-surface-raised" style={{ borderCurve: 'continuous' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message the assistant…"
          placeholderTextColor={colors.contentTertiary}
          multiline
          editable={!isStreaming}
          blurOnSubmit={false}
          className="max-h-28 px-3.5 pb-1.5 pt-3 text-[15px] text-content"
          style={{ minHeight: 56 }}
        />

        <View className="flex-row items-center px-1 pb-1.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', gap: 2, paddingHorizontal: 2 }}
            className="flex-1"
          >
            <ToolbarIconButton icon={Paperclip} onPress={handleAttach} accessibilityLabel="Attach image" />
            <ToolbarIconButton
              icon={Wrench}
              onPress={() => setPlaceholderSheet({ title: 'MCP Tools', description: 'MCP tool integration will be available in a future update.', icon: Wrench })}
              disabled
              accessibilityLabel="Tools"
            />
            <ToolbarIconButton
              icon={Sparkles}
              onPress={() => setPlaceholderSheet({ title: 'Skills', description: 'Skill management will be available in a future update.', icon: Sparkles })}
              disabled
              accessibilityLabel="Skills"
            />
            <ToolbarIconButton
              icon={Lightbulb}
              onPress={() => setShowThinkingSheet(true)}
              disabled={!modelReasoning}
              badge={modelReasoning ? THINKING_BADGE[thinkingLevel] : undefined}
              accessibilityLabel="Thinking level"
            />
            <ToolbarIconButton
              icon={ShieldCheck}
              onPress={() => setPlaceholderSheet({ title: 'Permission Mode', description: 'Permission mode control will be available in a future update.', icon: ShieldCheck })}
              disabled
              accessibilityLabel="Permission mode"
            />

            <Pressable
              onPress={onModelPress}
              className="ml-0.5 flex-row items-center rounded-full bg-surface-sunken px-2.5 py-1"
            >
              <Text className="max-w-[100px] text-[12px] font-medium text-content-secondary" numberOfLines={1}>
                {modelName ?? 'Select model'}
              </Text>
              <ChevronDown size={12} color={colors.contentTertiary} className="ml-0.5" />
            </Pressable>

            <View className="ml-0.5 flex-row items-center gap-0.5 rounded-full bg-surface-sunken px-2 py-1">
              <Gauge size={11} color={colors.contentTertiary} />
              <Text className="text-[11px] font-medium text-content-tertiary">
                {contextUsagePercent}
                %
              </Text>
            </View>
          </ScrollView>

          {isStreaming
            ? (
              <Pressable
                onPress={onStop}
                className="ml-1 mr-0.5 h-7 w-7 items-center justify-center rounded-full bg-danger"
              >
                <Square size={11} color="#ffffff" fill="#ffffff" />
              </Pressable>
            )
            : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={cn('ml-1 mr-0.5 h-7 w-7 items-center justify-center rounded-full', {
                  'bg-accent active:opacity-80': canSend,
                  'bg-surface-sunken': !canSend,
                })}
              >
                <Send size={13} color={canSend ? colors.accentContent : colors.contentTertiary} />
              </Pressable>
            )}
        </View>
      </View>

      <ThinkingLevelSheet
        visible={showThinkingSheet}
        level={thinkingLevel}
        supportsReasoning={modelReasoning}
        onSelect={onThinkingLevelChange}
        onClose={() => setShowThinkingSheet(false)}
      />

      {placeholderSheet != null
        ? (
          <PlaceholderSheet
            visible
            title={placeholderSheet.title}
            icon={placeholderSheet.icon}
            description={placeholderSheet.description}
            onClose={() => setPlaceholderSheet(null)}
          />
        )
        : null}
    </View>
  );
}
