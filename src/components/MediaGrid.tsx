import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { type ReactElement, useMemo, useRef, useState } from "react";
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollViewProps,
} from "react-native";
import { PixelRatio, useWindowDimensions, View } from "react-native";
import {
    GestureDetector,
    ScrollView,
    usePinchGesture,
} from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
    FastScroller,
    type FastScrollerHandle,
} from "@/components/FastScroller";
import {
    type MediaGridOrigin,
    MediaGridRow,
    type MediaGridRowEntry,
} from "@/components/MediaGridRow";
import { Text } from "@/components/ui/text";
import type { MediaListEntry } from "@/lib/database";
import { getDayKey, getGallerySection } from "@/lib/format";
import {
    GALLERY_COLUMNS,
    type GalleryScale,
    useSettings,
} from "@/lib/settings";

const TILE_SPACING = 2;
const HEADER_HEIGHT = PixelRatio.roundToNearestPixel(44);
const PRELOAD_ROW_COUNT = 4;
const VIEWABILITY_CONFIG = {
    minimumViewTime: 0,
    itemVisiblePercentThreshold: 1,
};
function GridScrollView(props: ScrollViewProps) {
    return (
        <ScrollView
            {...props}
            disallowInterruption={false}
            disableScrollViewPanResponder
            shouldCancelWhenOutside={false}
        />
    );
}

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

export function MediaGrid({
    entries,
    onPressItem,
    empty,
    topInset = 0,
    bottomInset = 0,
}: MediaGridProps) {
    const { width, height } = useWindowDimensions();
    const galleryScale = useSettings((state) => state.galleryScale);
    const setGalleryScale = useSettings((state) => state.setGalleryScale);
    const baseColumns = GALLERY_COLUMNS[galleryScale];
    const columnCount = Math.max(
        baseColumns,
        Math.round((width / 390) * baseColumns),
    );
    const listRef = useRef<FlashListRef<GridItem>>(null);
    const scrollerRef = useRef<FastScrollerHandle>(null);
    const anchorIndex = useRef<number | null>(null);
    const tileSize = (width - TILE_SPACING * (columnCount - 1)) / columnCount;
    const { items, contentHeight } = useMemo(
        () => buildGridItems(entries, tileSize, columnCount, galleryScale),
        [entries, tileSize, columnCount, galleryScale],
    );
    const initialScrollIndex = useMemo(
        () =>
            anchorIndex.current === null
                ? 0
                : Math.max(
                      0,
                      items.findIndex(
                          (item) =>
                              item.type === "row" &&
                              item.entries.some(
                                  (entry) =>
                                      entry.index === anchorIndex.current,
                              ),
                      ),
                  ),
        [items],
    );
    const scaleChanged = useSharedValue(false);
    const transitionOrigins = useRef(new Map<number, MediaGridOrigin>());
    const [isPinching, setIsPinching] = useState(false);

    function changeScale(scale: number) {
        let visibleIndex = listRef.current?.getFirstVisibleIndex() ?? 0;

        if (items[visibleIndex]?.type === "header") {
            visibleIndex += 1;
        }
        const item = items[visibleIndex];

        if (item?.type === "row") {
            anchorIndex.current = item.entries[0].index;
        }
        const scales = Object.keys(GALLERY_COLUMNS) as GalleryScale[];

        const nextScale =
            scales[
                Math.max(
                    0,
                    Math.min(
                        scales.length - 1,
                        scales.indexOf(galleryScale) + (scale < 1 ? 1 : -1),
                    ),
                )
            ];

        if (nextScale !== galleryScale) {
            transitionOrigins.current.clear();
            for (
                let rowIndex = visibleIndex;
                rowIndex < items.length;
                rowIndex++
            ) {
                const row = items[rowIndex];
                const y = row.offset + topInset - scrollOffset.current;

                if (y > height) {
                    break;
                }
                if (row.type === "row") {
                    row.entries.forEach(({ index }, column) => {
                        transitionOrigins.current.set(index, {
                            x: column * (tileSize + TILE_SPACING),
                            y,
                            size: tileSize,
                        });
                    });
                }
            }
            setGalleryScale(nextScale);
        }
    }

    const pinchGesture = usePinchGesture({
        onTouchesDown: (event) => {
            "worklet";
            if (event.numberOfTouches >= 2) {
                scheduleOnRN(setIsPinching, true);
            }
        },
        onUpdate: (event) => {
            "worklet";
            if (!scaleChanged.value && Math.abs(event.scale - 1) >= 0.14) {
                scaleChanged.value = true;
                scheduleOnRN(changeScale, event.scale);
            }
        },
        onFinalize: () => {
            "worklet";
            scaleChanged.value = false;
            scheduleOnRN(setIsPinching, false);
        },
    });
    const scrollOffset = useRef(0);
    const [visibleKeys, setVisibleKeys] = useState(new Set<string>());

    function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
        scrollerRef.current?.handleScroll(event);
    }

    return (
        <GestureDetector gesture={pinchGesture}>
            <View className="flex-1 overflow-hidden">
                <View className="flex-1">
                    <FlashList
                        key={`${galleryScale}:${columnCount}`}
                        initialScrollIndex={initialScrollIndex}
                        ref={listRef}
                        renderScrollComponent={GridScrollView}
                        overrideProps={{ simultaneousWith: pinchGesture }}
                        data={items}
                        extraData={visibleKeys}
                        keyExtractor={(item) => item.key}
                        getItemType={(item) => item.type}
                        drawDistance={
                            (tileSize + TILE_SPACING + HEADER_HEIGHT) *
                            PRELOAD_ROW_COUNT
                        }
                        showsVerticalScrollIndicator={false}
                        scrollEventThrottle={16}
                        onScroll={handleScroll}
                        viewabilityConfig={VIEWABILITY_CONFIG}
                        onViewableItemsChanged={({ viewableItems }) =>
                            setVisibleKeys(
                                new Set(
                                    viewableItems.map((token) => token.key),
                                ),
                            )
                        }
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
                                    origins={
                                        isPinching
                                            ? transitionOrigins.current
                                            : undefined
                                    }
                                    offset={
                                        item.offset -
                                        items[initialScrollIndex].offset
                                    }
                                    priority={
                                        visibleKeys.has(item.key)
                                            ? "high"
                                            : "low"
                                    }
                                    onPressItem={onPressItem}
                                />
                            )
                        }
                    />
                </View>
                <FastScroller
                    ref={scrollerRef}
                    top={topInset}
                    bottom={bottomInset}
                    contentHeight={contentHeight + topInset + bottomInset}
                    resolveLabel={(offset) =>
                        items[findGridItemIndex(items, offset - topInset)]
                            ?.sectionTitle ?? null
                    }
                    onScrollToOffset={(offset) => {
                        scrollOffset.current = offset;
                        listRef.current?.scrollToOffset({
                            offset,
                            animated: false,
                        });
                    }}
                />
            </View>
        </GestureDetector>
    );
}

function findGridItemIndex(items: GridItem[], offset: number) {
    let start = 0;
    let end = items.length - 1;

    while (start <= end) {
        const middle = Math.floor((start + end) / 2);

        if (items[middle].offset <= offset) {
            start = middle + 1;
        } else {
            end = middle - 1;
        }
    }

    return Math.max(0, end);
}

function buildGridItems(
    entries: MediaListEntry[],
    tileSize: number,
    columnCount: number,
    galleryScale: GalleryScale,
) {
    const items: GridItem[] = [];
    const rowHeight = PixelRatio.roundToNearestPixel(tileSize + TILE_SPACING);
    let currentSectionKey: number | null = null;
    let currentDayKey: number | null = null;
    let sectionTitle = "";
    let offset = 0;
    let row: Extract<GridItem, { type: "row" }> | undefined;

    entries.forEach((entry, index) => {
        const dayKey = getDayKey(entry.sortTime);

        if (dayKey !== currentDayKey) {
            currentDayKey = dayKey;
            const section = getGallerySection(entry.sortTime, galleryScale);

            if (section.key !== currentSectionKey) {
                currentSectionKey = section.key;
                sectionTitle = section.title;
                row = undefined;
                items.push({
                    type: "header",
                    key: `header:${galleryScale}:${section.key}`,
                    sectionTitle,
                    offset,
                });
                offset += HEADER_HEIGHT;
            }
        }

        if (!row || row.entries.length === columnCount) {
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
