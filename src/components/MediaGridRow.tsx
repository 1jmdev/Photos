import { useMappingHelper } from "@shopify/flash-list";
import { memo } from "react";
import { PixelRatio, Pressable, View } from "react-native";
import Animated, { Easing, withTiming } from "react-native-reanimated";

import { MediaThumbnail } from "@/components/MediaThumbnail";
import { Text } from "@/components/ui/text";
import type { MediaListEntry } from "@/lib/database";
import { formatDuration } from "@/lib/format";

export type MediaGridRowEntry = {
    entry: MediaListEntry;
    index: number;
};

export type MediaGridOrigin = { x: number; y: number; size: number };

const GRID_TRANSITION = { duration: 360, easing: Easing.out(Easing.cubic) };

type MediaGridRowProps = {
    entries: MediaGridRowEntry[];
    size: number;
    spacing: number;
    origins?: Map<number, MediaGridOrigin>;
    offset: number;
    loadingEnabled: boolean;
    onPressItem: (index: number) => void;
};

export const MediaGridRow = memo(function MediaGridRow({
    entries,
    size,
    spacing,
    origins,
    offset,
    loadingEnabled,
    onPressItem,
}: MediaGridRowProps) {
    const { getMappingKey } = useMappingHelper();

    return (
        <View
            className="flex-row"
            style={{
                height: PixelRatio.roundToNearestPixel(size + spacing),
                gap: spacing,
            }}
        >
            {entries.map(({ entry, index }, column) => {
                const origin = origins?.get(index);

                return (
                    <Animated.View
                        key={getMappingKey(entry.id, column)}
                        entering={
                            origin
                                ? () => {
                                      "worklet";
                                      return {
                                          initialValues: {
                                              transform: [
                                                  {
                                                      translateX:
                                                          origin.x -
                                                          column *
                                                              (size + spacing) +
                                                          (origin.size - size) /
                                                              2,
                                                  },
                                                  {
                                                      translateY:
                                                          origin.y -
                                                          offset +
                                                          (origin.size - size) /
                                                              2,
                                                  },
                                                  { scale: origin.size / size },
                                              ],
                                          },
                                          animations: {
                                              transform: [
                                                  {
                                                      translateX: withTiming(
                                                          0,
                                                          GRID_TRANSITION,
                                                      ),
                                                  },
                                                  {
                                                      translateY: withTiming(
                                                          0,
                                                          GRID_TRANSITION,
                                                      ),
                                                  },
                                                  {
                                                      scale: withTiming(
                                                          1,
                                                          GRID_TRANSITION,
                                                      ),
                                                  },
                                              ],
                                          },
                                      };
                                  }
                                : undefined
                        }
                    >
                        <Pressable
                            onPress={() => onPressItem(index)}
                            style={{ width: size, height: size }}
                        >
                            <MediaThumbnail
                                uri={entry.id}
                                size={size}
                                loadingEnabled={loadingEnabled}
                            />
                            {entry.duration !== null && (
                                <Text
                                    className="absolute bottom-1 right-1.5 text-xs font-semibold text-white"
                                    style={{
                                        textShadowColor: "rgba(0, 0, 0, 0.7)",
                                        textShadowRadius: 3,
                                    }}
                                >
                                    {formatDuration(entry.duration)}
                                </Text>
                            )}
                        </Pressable>
                    </Animated.View>
                );
            })}
        </View>
    );
});
