import { useNavigation } from "@react-navigation/native";
import { Images, type LucideIcon, SquareLibrary } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlbumGrid } from "@/components/AlbumGrid";
import { PhotoGrid } from "@/components/PhotoGrid";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useMediaLibrary } from "@/hooks/use-media-library";
import { useAlbums, usePhotoIds } from "@/hooks/use-photos";
import { cn } from "@/lib/utils";

type Tab = "photos" | "albums";

const HEADER_HEIGHT = 52;
const TAB_BAR_HEIGHT = 56;

export function HomeScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { isGranted, syncStatus, requestPermission } = useMediaLibrary();
    const { ids, isLoaded } = usePhotoIds();
    const albums = useAlbums();
    const [tab, setTab] = useState<Tab>("photos");

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
                    Allow access to your photo library to browse your photos and
                    albums.
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
                <PhotoGrid
                    ids={ids}
                    topInset={topInset}
                    bottomInset={bottomInset}
                    onPressPhoto={(index) =>
                        navigation.navigate("Viewer", { index })
                    }
                    empty={
                        isLoaded && !isIndexing ? (
                            <EmptyState message="No photos yet" />
                        ) : undefined
                    }
                />
            </View>

            <View className={cn("flex-1", tab !== "albums" && "hidden")}>
                <AlbumGrid
                    albums={albums ?? []}
                    topInset={topInset + 8}
                    bottomInset={bottomInset}
                    onPressAlbum={(album) =>
                        navigation.navigate("Album", {
                            albumId: album.id,
                            title: album.title,
                        })
                    }
                    empty={
                        albums && !isIndexing ? (
                            <EmptyState message="No albums yet" />
                        ) : undefined
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
                {syncStatus === "idle" && tab === "photos" && isLoaded && (
                    <Text className="text-xs text-neutral-400">
                        {ids.length.toLocaleString()} photos
                    </Text>
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

type TabButtonProps = {
    label: string;
    icon: LucideIcon;
    isActive: boolean;
    onPress: () => void;
};

function TabButton({ label, icon, isActive, onPress }: TabButtonProps) {
    const colorClassName = isActive ? "text-white" : "text-neutral-500";

    return (
        <Pressable
            onPress={onPress}
            className="flex-1 items-center justify-center gap-1"
        >
            <Icon as={icon} size={22} className={colorClassName} />
            <Text className={cn("text-xs font-medium", colorClassName)}>
                {label}
            </Text>
        </Pressable>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <View className="items-center pt-32">
            <Text className="text-sm text-neutral-500">{message}</Text>
        </View>
    );
}
