import { useNavigation } from "@react-navigation/native";
import { Images, SquareLibrary } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlbumsOverview } from "@/components/AlbumsOverview";
import { MediaGrid } from "@/components/MediaGrid";
import { TabButton } from "@/components/TabButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useCollections, useMediaList } from "@/hooks/use-media-items";
import { useMediaLibrary } from "@/hooks/use-media-library";
import type { MediaSource } from "@/lib/database";
import { cn } from "@/lib/utils";

const ALL_ITEMS: MediaSource = { kind: "all" };
const HEADER_HEIGHT = 52;
const TAB_BAR_HEIGHT = 56;

export function HomeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { isGranted, syncStatus, requestPermission } = useMediaLibrary();
    const { entries, isLoaded } = useMediaList(ALL_ITEMS);
    const overview = useCollections();
    const [tab, setTab] = useState<"photos" | "albums">("photos");

    if (isGranted === undefined) {
        return <View className="flex-1 bg-black" />;
    }

    if (!isGranted) {
        return (
            <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
                <Icon as={Images} size={48} className="text-neutral-500" />
                <Text className="text-center text-xl font-semibold text-white">
                    Access your photos
                </Text>
                <Text className="text-center text-sm text-neutral-400">
                    Allow access to your library to browse your photos, videos
                    and albums.
                </Text>
                <Button className="mt-2" onPress={requestPermission}>
                    <Text>Allow access</Text>
                </Button>
            </View>
        );
    }

    const topInset = insets.top + HEADER_HEIGHT;
    const bottomInset = insets.bottom + TAB_BAR_HEIGHT;
    const isIndexing = syncStatus === "indexing";

    return (
        <View className="flex-1 bg-black">
            <View className={cn("flex-1", tab !== "photos" && "hidden")}>
                <MediaGrid
                    entries={entries}
                    topInset={topInset}
                    bottomInset={bottomInset}
                    onPressItem={(index) =>
                        navigation.navigate("Viewer", {
                            source: ALL_ITEMS,
                            index,
                        })
                    }
                    empty={
                        isLoaded && !isIndexing ? (
                            <View className="items-center pt-32">
                                <Text className="text-sm text-neutral-500">
                                    No photos yet
                                </Text>
                            </View>
                        ) : undefined
                    }
                />
            </View>

            <View className={cn("flex-1", tab !== "albums" && "hidden")}>
                <AlbumsOverview
                    collections={overview?.collections ?? []}
                    albums={overview?.albums ?? []}
                    topInset={topInset + 8}
                    bottomInset={bottomInset}
                    onPressCollection={(collection) =>
                        navigation.navigate("Album", {
                            source: collection.source,
                            title: collection.title,
                        })
                    }
                />
            </View>

            <View
                className="absolute inset-x-0 top-0 flex-row items-center justify-between bg-black/90 px-4"
                style={{ paddingTop: insets.top, height: topInset }}
            >
                <Text className="text-2xl font-bold text-white">
                    {tab === "photos" ? "Photos" : "Albums"}
                </Text>
                {syncStatus !== "idle" && (
                    <View className="flex-row items-center gap-2">
                        <ActivityIndicator size="small" color="#a3a3a3" />
                        <Text className="text-xs text-neutral-400">
                            {isIndexing ? "Indexing" : "Updating"}
                        </Text>
                    </View>
                )}
            </View>

            <View
                className="absolute inset-x-0 bottom-0 flex-row border-t border-neutral-900 bg-black/95"
                style={{ paddingBottom: insets.bottom, height: bottomInset }}
            >
                <TabButton
                    label="Photos"
                    icon={Images}
                    isActive={tab === "photos"}
                    onPress={() => setTab("photos")}
                />
                <TabButton
                    label="Albums"
                    icon={SquareLibrary}
                    isActive={tab === "albums"}
                    onPress={() => setTab("albums")}
                />
            </View>
        </View>
    );
}
