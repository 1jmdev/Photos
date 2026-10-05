import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import type { ReactElement } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { Album } from "@/lib/database";

const COLUMN_COUNT = 2;
const HORIZONTAL_PADDING = 16;
const CARD_SPACING = 12;

type AlbumGridProps = {
    albums: Album[];
    onPressAlbum: (album: Album) => void;
    empty?: ReactElement;
    topInset?: number;
    bottomInset?: number;
};

export function AlbumGrid({
    albums,
    onPressAlbum,
    empty,
    topInset = 0,
    bottomInset = 0,
}: AlbumGridProps) {
    const { width } = useWindowDimensions();
    const coverSize =
        (width - HORIZONTAL_PADDING * 2 - CARD_SPACING * (COLUMN_COUNT - 1)) /
        COLUMN_COUNT;

    return (
        <FlashList
            data={albums}
            numColumns={COLUMN_COUNT}
            keyExtractor={(album) => album.id}
            ListEmptyComponent={empty}
            contentContainerStyle={{
                paddingTop: topInset,
                paddingBottom: bottomInset,
                paddingHorizontal: HORIZONTAL_PADDING,
            }}
            renderItem={({ item, index }) => (
                <Pressable
                    onPress={() => onPressAlbum(item)}
                    className="mb-5 active:opacity-70"
                    style={{
                        width: coverSize,
                        marginLeft:
                            index % COLUMN_COUNT === 0 ? 0 : CARD_SPACING,
                    }}
                >
                    <Image
                        source={{ uri: item.coverPhotoId }}
                        recyclingKey={item.coverPhotoId}
                        contentFit="cover"
                        cachePolicy="memory"
                        style={{
                            width: coverSize,
                            height: coverSize,
                            borderRadius: 12,
                            backgroundColor: "#171717",
                        }}
                    />
                    <View className="mt-2 gap-0.5">
                        <Text
                            numberOfLines={1}
                            className="text-sm font-medium text-white"
                        >
                            {item.title}
                        </Text>
                        <Text className="text-xs text-neutral-400">
                            {item.photoCount.toLocaleString()}
                        </Text>
                    </View>
                </Pressable>
            )}
        />
    );
}
