import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { PixelRatio, useWindowDimensions, View } from "react-native";

import {
    FastScroller,
    type FastScrollerHandle,
} from "@/components/FastScroller";
import {
    MediaGridRow,
    type MediaGridRowEntry,
} from "@/components/MediaGridRow";
import { Text } from "@/components/ui/text";
import type { MediaListEntry } from "@/lib/database";
import { formatDayTitle, getDayKey } from "@/lib/format";

const COLUMN_COUNT = 4;
const TILE_SPACING = 2;
const HEADER_HEIGHT = PixelRatio.roundToNearestPixel(44);
const VIEWABILITY_CONFIG = {
    minimumViewTime: 120,
    itemVisiblePercentThreshold: 1,
};

type GridItem =
    | { type: "header"; key: string; sectionTitle: string; offset: number }
    | {
          type: "row";
          key: string;
          entries: MediaGridRowEntry[];
          sectionTitle: string;
          offset: number;
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
    const { width, height } = useWindowDimensions();
    const listRef = useRef<FlashListRef<GridItem>>(null);
    const scrollerRef = useRef<FastScrollerHandle>(null);
    const tileSize = (width - TILE_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
    const { items, contentHeight } = useMemo(
        () => buildGridItems(entries, tileSize),
        [entries, tileSize],
    );
    const [visibleKeys, setVisibleKeys] = useState(new Set<string>());
    const visibleKeysRef = useRef(visibleKeys);
    const [isLoadingPaused, setIsLoadingPaused] = useState(false);
    const scrollState = useRef({
        offset: 0,
        time: performance.now(),
        isLoadingPaused: false,
    });
    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandleDragging = useRef(false);

    useEffect(
        () => () => {
            if (resumeTimer.current) {
                clearTimeout(resumeTimer.current);
            }
        },
        [],
    );

    function pauseLoading(paused: boolean) {
        if (scrollState.current.isLoadingPaused !== paused) {
            scrollState.current.isLoadingPaused = paused;
            setIsLoadingPaused(paused);
            if (!paused) {
                setVisibleKeys(visibleKeysRef.current);
            }
        }
        if (resumeTimer.current) {
            clearTimeout(resumeTimer.current);
        }
        resumeTimer.current =
            paused && !isHandleDragging.current
                ? setTimeout(() => pauseLoading(false), 120)
                : null;
    }

    function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const time = performance.now();
        const offset = event.nativeEvent.contentOffset.y;
        const speed =
            (Math.abs(offset - scrollState.current.offset) * 1000) /
            (Math.max(1, time - scrollState.current.time) * height);

        pauseLoading(
            isHandleDragging.current ||
                speed > (scrollState.current.isLoadingPaused ? 0.75 : 2),
        );
        scrollState.current.offset = offset;
        scrollState.current.time = time;
        scrollerRef.current?.handleScroll(event);
    }

    function resolveLabel(offset: number): string | null {
        let start = 0;
        let end = items.length - 1;

        while (start <= end) {
            const middle = Math.floor((start + end) / 2);

            if (items[middle].offset <= offset - topInset) {
                start = middle + 1;
            } else {
                end = middle - 1;
            }
        }

        return items[Math.max(0, end)]?.sectionTitle ?? null;
    }

    return (
        <View className="flex-1">
            <FlashList
                ref={listRef}
                data={items}
                extraData={isLoadingPaused ? null : visibleKeys}
                keyExtractor={(item) => item.key}
                getItemType={(item) => item.type}
                drawDistance={tileSize * 2}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleScroll}
                onMomentumScrollEnd={() =>
                    pauseLoading(isHandleDragging.current)
                }
                viewabilityConfig={VIEWABILITY_CONFIG}
                onViewableItemsChanged={({ viewableItems }) => {
                    visibleKeysRef.current = new Set(
                        viewableItems.map((token) => token.key),
                    );
                    if (!scrollState.current.isLoadingPaused) {
                        setVisibleKeys(visibleKeysRef.current);
                    }
                }}
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
                                {item.sectionTitle}
                            </Text>
                        </View>
                    ) : (
                        <MediaGridRow
                            entries={item.entries}
                            size={tileSize}
                            spacing={TILE_SPACING}
                            loadingEnabled={
                                !isLoadingPaused && visibleKeys.has(item.key)
                            }
                            onPressItem={onPressItem}
                        />
                    )
                }
            />
            <FastScroller
                ref={scrollerRef}
                top={topInset}
                bottom={bottomInset}
                contentHeight={contentHeight + topInset + bottomInset}
                resolveLabel={resolveLabel}
                onDraggingChange={(isDragging) => {
                    isHandleDragging.current = isDragging;
                    pauseLoading(isDragging);
                }}
                onScrollToOffset={(offset) => {
                    pauseLoading(true);
                    listRef.current?.scrollToOffset({
                        offset,
                        animated: false,
                    });
                }}
            />
        </View>
    );
}

function buildGridItems(entries: MediaListEntry[], tileSize: number) {
    const items: GridItem[] = [];
    const rowHeight = PixelRatio.roundToNearestPixel(tileSize + TILE_SPACING);
    let currentDayKey: number | null = null;
    let sectionTitle = "";
    let offset = 0;
    let row: Extract<GridItem, { type: "row" }> | undefined;

    entries.forEach((entry, index) => {
        const dayKey = getDayKey(entry.sortTime);

        if (dayKey !== currentDayKey) {
            currentDayKey = dayKey;
            sectionTitle = formatDayTitle(entry.sortTime);
            row = undefined;
            items.push({
                type: "header",
                key: `header:${dayKey}`,
                sectionTitle,
                offset,
            });
            offset += HEADER_HEIGHT;
        }

        if (!row || row.entries.length === COLUMN_COUNT) {
            row = {
                type: "row",
                key: entry.id,
                entries: [],
                sectionTitle,
                offset,
            };
            items.push(row);
            offset += rowHeight;
        }
        row.entries.push({ entry, index });
    });

    return { items, contentHeight: offset };
}
