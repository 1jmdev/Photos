import { useMappingHelper } from "@shopify/flash-list";
import { memo } from "react";
import { PixelRatio, Pressable, View } from "react-native";

import { MediaThumbnail } from "@/components/MediaThumbnail";
import { Text } from "@/components/ui/text";
import type { MediaListEntry } from "@/lib/database";
import { formatDuration } from "@/lib/format";

export type MediaGridRowEntry = {
    entry: MediaListEntry;
    index: number;
};

type MediaGridRowProps = {
    entries: MediaGridRowEntry[];
    size: number;
    spacing: number;
    loadingEnabled: boolean;
    onPressItem: (index: number) => void;
};

export const MediaGridRow = memo(function MediaGridRow({
    entries,
    size,
    spacing,
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
            {entries.map(({ entry, index }, column) => (
                <Pressable
                    key={getMappingKey(entry.id, column)}
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
            ))}
        </View>
    );
});
