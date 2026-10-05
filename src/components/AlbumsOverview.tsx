import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Images } from "lucide-react-native";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type Collection, getSourceKey } from "@/lib/database";

const HORIZONTAL_PADDING = 16;
const CARD_SPACING = 12;

/** Collections row shows three cards and a quarter of the fourth. */
const VISIBLE_COLLECTION_COUNT = 3.25;
const ALBUM_COLUMN_COUNT = 3;

type AlbumsOverviewProps = {
    collections: Collection[];
    albums: Collection[];
    onPressCollection: (collection: Collection) => void;
    topInset?: number;
    bottomInset?: number;
};

/**
 * Albums tab: a horizontally scrolling row of the main collections followed
 * by a grid of every other album on the device.
 */
export function AlbumsOverview({
    collections,
    albums,
    onPressCollection,
    topInset = 0,
    bottomInset = 0,
}: AlbumsOverviewProps) {
    const { width } = useWindowDimensions();
    const collectionCardSize =
        (width -
            HORIZONTAL_PADDING -
            CARD_SPACING * Math.floor(VISIBLE_COLLECTION_COUNT)) /
        VISIBLE_COLLECTION_COUNT;
    const albumCardSize =
        (width -
            HORIZONTAL_PADDING * 2 -
            CARD_SPACING * (ALBUM_COLUMN_COUNT - 1)) /
        ALBUM_COLUMN_COUNT;

    return (
        <FlashList
            data={albums}
            numColumns={ALBUM_COLUMN_COUNT}
            keyExtractor={(album) => getSourceKey(album.source)}
            contentContainerStyle={{
                paddingTop: topInset,
                paddingBottom: bottomInset,
            }}
            ListHeaderComponent={
                <View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: HORIZONTAL_PADDING,
                            gap: CARD_SPACING,
                        }}
                    >
                        {collections.map((collection) => (
                            <CollectionCard
                                key={getSourceKey(collection.source)}
                                collection={collection}
                                size={collectionCardSize}
                                onPress={() => onPressCollection(collection)}
                            />
                        ))}
                    </ScrollView>

                    {albums.length > 0 && (
                        <Text className="px-4 pb-3 pt-6 text-lg font-semibold text-white">
                            Albums
                        </Text>
                    )}
                </View>
            }
            renderItem={({ item, index }) => {
                const column = index % ALBUM_COLUMN_COUNT;

                // Each column cell is `width / ALBUM_COLUMN_COUNT` wide; the
                // offset places cards at equal spacing within the padding.
                const offset =
                    HORIZONTAL_PADDING +
                    column * (albumCardSize + CARD_SPACING) -
                    (column * width) / ALBUM_COLUMN_COUNT;

                return (
                    <View style={{ marginLeft: offset }}>
                        <CollectionCard
                            collection={item}
                            size={albumCardSize}
                            onPress={() => onPressCollection(item)}
                        />
                    </View>
                );
            }}
        />
    );
}

type CollectionCardProps = {
    collection: Collection;
    size: number;
    onPress: () => void;
};

function CollectionCard({ collection, size, onPress }: CollectionCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="mb-4 active:opacity-70"
            style={{ width: size }}
        >
            {collection.coverId ? (
                <Image
                    source={{ uri: collection.coverId }}
                    recyclingKey={collection.coverId}
                    contentFit="cover"
                    cachePolicy="memory"
                    style={{
                        width: size,
                        height: size,
                        borderRadius: 14,
                        backgroundColor: "#171717",
                    }}
                />
            ) : (
                <View
                    className="items-center justify-center bg-neutral-900"
                    style={{ width: size, height: size, borderRadius: 14 }}
                >
                    <Icon as={Images} size={28} className="text-neutral-600" />
                </View>
            )}
            <Text
                numberOfLines={1}
                className="mt-2 text-sm font-medium text-white"
            >
                {collection.title}
            </Text>
            <Text className="text-xs text-neutral-400">
                {collection.itemCount.toLocaleString()}
            </Text>
        </Pressable>
    );
}
