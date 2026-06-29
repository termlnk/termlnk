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

import type { IMobileChatSession } from '@termlnk/agent-mobile';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import { MessageSquare } from 'lucide-react-native';
import { memo, useCallback, useRef } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useThemeColors } from '../../theme/theme-provider';

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(isoDate).toLocaleDateString();
}

function DeleteAction(_progress: SharedValue<number>, drag: SharedValue<number>) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.get() + 80 }],
  }));
  return (
    <Animated.View
      style={[
        { width: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ef4444' },
        animatedStyle,
      ]}
    >
      <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
    </Animated.View>
  );
}

interface ISessionRowProps {
  readonly id: string;
  readonly title: string;
  readonly modelId: string | undefined;
  readonly updatedAt: string;
  readonly messageCount: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onSelect: (sessionId: string) => void;
  readonly onDelete: (sessionId: string) => void;
}

const SessionRow = memo(function SessionRow({
  id,
  title,
  modelId,
  updatedAt,
  messageCount,
  isFirst,
  isLast,
  onSelect,
  onDelete,
}: ISessionRowProps) {
  const colors = useThemeColors();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handlePress = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  const handleSwipeOpen = useCallback(() => {
    swipeableRef.current?.close();
    Alert.alert('Delete Chat', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
    ]);
  }, [id, title, onDelete]);

  const subtitle = [
    modelId ?? 'Unknown model',
    formatRelativeTime(updatedAt),
    messageCount > 0 ? `${messageCount} msgs` : null,
  ].filter(Boolean).join(' · ');

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={DeleteAction}
      onSwipeableOpen={handleSwipeOpen}
      overshootRight={false}
      containerStyle={[
        { overflow: 'hidden', marginHorizontal: 16 },
        isFirst ? { borderTopLeftRadius: 16, borderTopRightRadius: 16 } : undefined,
        isLast ? { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } : undefined,
      ]}
    >
      <Pressable
        onPress={handlePress}
        className="flex-row items-center bg-surface-raised px-4 py-3.5 active:bg-surface-sunken"
      >
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.contentTertiary}12` }}
        >
          <MessageSquare size={18} color={colors.contentTertiary} />
        </View>
        <View className="flex-1">
          <Text
            className="text-[15px] leading-5 text-content"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="mt-0.5 text-[12px] leading-4 text-content-secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

interface ISessionListProps {
  readonly sessions: readonly IMobileChatSession[];
  readonly onSelect: (sessionId: string) => void;
  readonly onDelete: (sessionId: string) => void;
  readonly contentPaddingBottom: number;
}

const SEPARATOR_INSET = { marginLeft: 64 };

function ItemSeparator() {
  return (
    <View className="bg-surface-raised" style={{ marginHorizontal: 16 }}>
      <View className="h-px bg-divider/50" style={SEPARATOR_INSET} />
    </View>
  );
}

const keyExtractor = (item: IMobileChatSession) => item.id;

export function SessionList({ sessions, onSelect, onDelete, contentPaddingBottom }: ISessionListProps) {
  const renderItem = useCallback(({ item, index }: { item: IMobileChatSession; index: number }) => (
    <SessionRow
      id={item.id}
      title={item.title}
      modelId={item.modelId}
      updatedAt={item.updatedAt}
      messageCount={item.messageCount}
      isFirst={index === 0}
      isLast={index === sessions.length - 1}
      onSelect={onSelect}
      onDelete={onDelete}
    />
  ), [sessions.length, onSelect, onDelete]);

  if (sessions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-[15px] text-content-tertiary">No chat history yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={ItemSeparator}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: contentPaddingBottom }}
    />
  );
}
