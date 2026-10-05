import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Image } from "expo-image";
import { type ReactElement, useMemo, useRef } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import {
    FastScroller,
    type FastScrollerHandle,
} from "@/components/FastScroller";
import { Text } from "@/components/ui/text";
import type { MediaListEntry } from "@/lib/database";
import { formatDayTitle, formatDuration, getDayKey } from "@/lib/format";

const COLUMN_COUNT = 4;
const TILE_SPACING = 2;
const HEADER_HEIGHT = 44;

type GridItem =
    | { type: "header"; key: string; title: string }
    | {
          type: "media";
          key: string;
          entry: MediaListEntry;
          /** Position of the item in the media list, used by the viewer. */
          index: number;
          column: number;
          sectionTitle: string;
      };

type MediaGridProps = {
    entries: MediaListEntry[];
    onPressItem: (index: number) => void;
    empty?: ReactElement;
    topInset?: number;
    bottomInset?: number;
};

/**
 * Four-column grid of thumbnails grouped under a header for each day. The
 * item identifier is a system media URI (`content://` on Android, `ph://` on
 * iOS), so each thumbnail is loaded at tile size instead of full resolution.
 */
export function MediaGrid({
    entries,
    onPressItem,
    empty,
    topInset = 0,
    bottomInset = 0,
}: MediaGridProps) {
    const { width } = useWindowDimensions();
    const listRef = useRef<FlashListRef<GridItem>>(null);
    const scrollerRef = useRef<FastScrollerHandle>(null);
    const items = useMemo(() => buildGridItems(entries), [entries]);

    // Every column cell is `width / COLUMN_COUNT` wide. Offsetting each tile
    // by a quarter of the spacing per column distributes the gaps evenly.
    const tileSize = (width - TILE_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

    function resolveLabel(): string | null {
        const item = items[listRef.current?.getFirstVisibleIndex() ?? 0];

        if (!item) {
            return null;
        }

        return item.type === "header" ? item.title : item.sectionTitle;
    }

    return (
        <View className="flex-1">
            <FlashList
                ref={listRef}
                data={items}
                numColumns={COLUMN_COUNT}
                keyExtractor={(item) => item.key}
                getItemType={(item) => item.type}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = COLUMN_COUNT;
                    }
                }}
                drawDistance={tileSize * 6}
                showsVerticalScrollIndicator={false}
                onScroll={(event) => scrollerRef.current?.handleScroll(event)}
                ListEmptyComponent={empty}
                contentContainerStyle={{
                    paddingTop: topInset,
                    paddingBottom: bottomInset,
                }}
                renderItem={({ item }) =>
                    item.type === "header" ? (
                        <View
                            className="justify-end px-3 pb-2"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            <Text className="text-sm font-semibold text-white">
                                {item.title}
                            </Text>
                        </View>
                    ) : (
                        <Pressable
                            onPress={() => onPressItem(item.index)}
                            style={{
                                width: tileSize,
                                height: tileSize,
                                marginLeft:
                                    (item.column * TILE_SPACING) / COLUMN_COUNT,
                                marginBottom: TILE_SPACING,
                            }}
                        >
                            <Image
                                source={{ uri: item.entry.id }}
                                recyclingKey={item.entry.id}
                                contentFit="cover"
                                cachePolicy="memory"
                                style={{
                                    width: tileSize,
                                    height: tileSize,
                                    backgroundColor: "#171717",
                                }}
                            />
                            {item.entry.duration !== null && (
                                <Text
                                    className="absolute bottom-1 right-1.5 text-xs font-semibold text-white"
                                    style={{
                                        textShadowColor: "rgba(0, 0, 0, 0.7)",
                                        textShadowRadius: 3,
                                    }}
                                >
                                    {formatDuration(item.entry.duration)}
                                </Text>
                            )}
                        </Pressable>
                    )
                }
            />
            <FastScroller
                ref={scrollerRef}
                top={topInset}
                bottom={bottomInset}
                resolveLabel={resolveLabel}
                onScrollToOffset={(offset) =>
                    listRef.current?.scrollToOffset({ offset, animated: false })
                }
            />
        </View>
    );
}

function buildGridItems(entries: MediaListEntry[]): GridItem[] {
    const items: GridItem[] = [];
    let currentDayKey: number | null = null;
    let sectionTitle = "";
    let column = 0;

    entries.forEach((entry, index) => {
        const dayKey = getDayKey(entry.sortTime);

        if (dayKey !== currentDayKey) {
            currentDayKey = dayKey;
            sectionTitle = formatDayTitle(entry.sortTime);
            column = 0;
            items.push({
                type: "header",
                key: `header:${dayKey}`,
                title: sectionTitle,
            });
        }

        items.push({
            type: "media",
            key: entry.id,
            entry,
            index,
            column,
            sectionTitle,
        });
        column = (column + 1) % COLUMN_COUNT;
    });

    return items;
}
