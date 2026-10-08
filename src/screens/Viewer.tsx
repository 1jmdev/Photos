import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Asset } from "expo-media-library";
import { shareAsync } from "expo-sharing";
import { Heart, Info, Share2, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DismissibleViewer } from "@/components/DismissibleViewer";
import { MediaInformation } from "@/components/MediaInformation";
import { Navbar } from "@/components/Navbar";
import { Icon } from "@/components/ui/icon";
import { VideoPlayback } from "@/components/VideoPlayback";
import { useMediaDetails, useMediaList } from "@/hooks/use-media-items";
import { getDatabase } from "@/lib/database";
import { syncMediaLibraryChange, useMediaSync } from "@/lib/media-sync";
import type { RootStackParamList } from "@/navigation";

export function ViewerScreen({
    navigation,
    route,
}: NativeStackScreenProps<RootStackParamList, "Viewer">) {
    const { source, index: initialIndex } = route.params;
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { entries } = useMediaList(source);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isChromeVisible, setIsChromeVisible] = useState(true);
    const [isInfoVisible, setIsInfoVisible] = useState(false);

    const currentEntry = entries[Math.min(currentIndex, entries.length - 1)];
    const { item, place } = useMediaDetails(currentEntry?.id);
    const takenAt = item?.creationTime ?? item?.modificationTime ?? null;

    return (
        <DismissibleViewer onDismiss={() => navigation.goBack()}>
            <StatusBar hidden={!isChromeVisible} barStyle="light-content" />
            {entries.length > 0 && (
                <FlashList
                    data={entries}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={Math.min(
                        initialIndex,
                        entries.length - 1,
                    )}
                    keyExtractor={(entry) => entry.id}
                    onMomentumScrollEnd={(event) =>
                        setCurrentIndex(
                            Math.round(
                                event.nativeEvent.contentOffset.x / width,
                            ),
                        )
                    }
                    renderItem={({ item: entry, index }) => (
                        <View style={{ width, height }}>
                            {entry.duration !== null &&
                            index === currentIndex ? (
                                <VideoPlayback
                                    key={entry.id}
                                    uri={entry.id}
                                    width={width}
                                    height={height}
                                    controlsVisible={
                                        isChromeVisible && !isInfoVisible
                                    }
                                    onToggleControls={() =>
                                        setIsChromeVisible(
                                            (isVisible) => !isVisible,
                                        )
                                    }
                                />
                            ) : (
                                <Pressable
                                    onPress={() =>
                                        setIsChromeVisible(
                                            (isVisible) => !isVisible,
                                        )
                                    }
                                >
                                    <Image
                                        source={{ uri: entry.id }}
                                        recyclingKey={entry.id}
                                        contentFit="contain"
                                        cachePolicy="memory"
                                        style={{ width, height }}
                                    />
                                </Pressable>
                            )}
                        </View>
                    )}
                />
            )}

            {isChromeVisible && (
                <Navbar takenAt={takenAt} onBack={() => navigation.goBack()} />
            )}

            {isChromeVisible && isInfoVisible && item && (
                <MediaInformation
                    item={item}
                    place={place}
                    bottomInset={insets.bottom + 64}
                />
            )}

            {isChromeVisible && item && (
                <View
                    className="absolute inset-x-0 bottom-0 flex-row items-center justify-around bg-black/60 pt-2"
                    style={{ paddingBottom: insets.bottom + 8 }}
                >
                    {[
                        {
                            icon: Share2,
                            label: "Share",
                            selected: false,
                            onPress: async () => {
                                await shareAsync(
                                    await new Asset(item.id).getUri(),
                                );
                            },
                        },
                        {
                            icon: Heart,
                            label: item.isFavorite
                                ? "Remove favorite"
                                : "Favorite",
                            selected: item.isFavorite,
                            onPress: async () => {
                                await new Asset(item.id).setFavorite(
                                    !item.isFavorite,
                                );
                                await (await getDatabase()).runAsync(
                                    "UPDATE media_items SET is_favorite = ? WHERE id = ?",
                                    item.isFavorite ? 0 : 1,
                                    item.id,
                                );
                                useMediaSync.setState((state) => ({
                                    revision: state.revision + 1,
                                }));
                            },
                        },
                        {
                            icon: Info,
                            label: "Media information",
                            selected: isInfoVisible,
                            onPress: () =>
                                setIsInfoVisible((visible) => !visible),
                        },
                        {
                            icon: Trash2,
                            label: "Delete",
                            selected: false,
                            onPress: async () => {
                                await new Asset(item.id).delete();
                                syncMediaLibraryChange({
                                    hasIncrementalChanges: true,
                                    insertedAssets: [],
                                    deletedAssets: [item.id],
                                });
                                navigation.goBack();
                            },
                        },
                    ].map((action) => (
                        <Pressable
                            key={action.label}
                            onPress={action.onPress}
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                            accessibilityState={{ selected: action.selected }}
                            className="h-12 w-12 items-center justify-center active:opacity-60"
                        >
                            <Icon
                                as={action.icon}
                                size={24}
                                fill={
                                    action.icon === Heart && action.selected
                                        ? "white"
                                        : "none"
                                }
                                className={
                                    action.selected && action.icon === Info
                                        ? "text-sky-400"
                                        : "text-white"
                                }
                            />
                        </Pressable>
                    ))}
                </View>
            )}
        </DismissibleViewer>
    );
}
