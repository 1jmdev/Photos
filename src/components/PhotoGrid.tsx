import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import type { ReactElement } from "react";
import { Pressable, useWindowDimensions } from "react-native";

const COLUMN_COUNT = 4;
const TILE_SPACING = 2;

type PhotoGridProps = {
    ids: string[];
    onPressPhoto: (index: number) => void;
    empty?: ReactElement;
    topInset?: number;
    bottomInset?: number;
};

/**
 * Four-column grid of photo thumbnails. The photo identifier is a system media
 * URI (`content://` on Android, `ph://` on iOS), so the operating system
 * provides a thumbnail sized to the tile instead of the full image.
 */
export function PhotoGrid({
    ids,
    onPressPhoto,
    empty,
    topInset = 0,
    bottomInset = 0,
}: PhotoGridProps) {
    const { width } = useWindowDimensions();
    const tileSize = (width - TILE_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

    return (
        <FlashList
            data={ids}
            numColumns={COLUMN_COUNT}
            keyExtractor={(id) => id}
            drawDistance={tileSize * 6}
            ListEmptyComponent={empty}
            contentContainerStyle={{
                paddingTop: topInset,
                paddingBottom: bottomInset,
            }}
            renderItem={({ item, index }) => (
                <Pressable
                    onPress={() => onPressPhoto(index)}
                    style={{
                        width: tileSize,
                        height: tileSize,
                        marginLeft:
                            index % COLUMN_COUNT === 0 ? 0 : TILE_SPACING,
                        marginBottom: TILE_SPACING,
                    }}
                >
                    <Image
                        source={{ uri: item }}
                        recyclingKey={item}
                        contentFit="cover"
                        cachePolicy="memory"
                        style={{
                            width: tileSize,
                            height: tileSize,
                            backgroundColor: "#171717",
                        }}
                    />
                </Pressable>
            )}
        />
    );
}
