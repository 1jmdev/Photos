import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { ChevronLeft, Info, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePhotoDetails, usePhotoIds } from "@/hooks/use-photos";
import type { Photo } from "@/lib/database";
import type { Place } from "@/lib/location";
import type { RootStackParamList } from "@/navigation";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
});
const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
});

export function ViewerScreen({
    navigation,
    route,
}: NativeStackScreenProps<RootStackParamList, "Viewer">) {
    const { albumId, index: initialIndex } = route.params;
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { ids } = usePhotoIds(albumId);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isChromeVisible, setIsChromeVisible] = useState(true);
    const [isInfoVisible, setIsInfoVisible] = useState(false);

    const currentId = ids[Math.min(currentIndex, ids.length - 1)];
    const { photo, place } = usePhotoDetails(currentId);
    const takenAt = photo?.creationTime ?? photo?.modificationTime ?? null;

    return (
        <View className="flex-1 bg-black">
            {ids.length > 0 && (
                <FlashList
                    data={ids}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={Math.min(initialIndex, ids.length - 1)}
                    keyExtractor={(id) => id}
                    onMomentumScrollEnd={(event) =>
                        setCurrentIndex(
                            Math.round(
                                event.nativeEvent.contentOffset.x / width,
                            ),
                        )
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() =>
                                setIsChromeVisible((isVisible) => !isVisible)
                            }
                            style={{ width, height }}
                        >
                            <Image
                                source={{ uri: item }}
                                recyclingKey={item}
                                contentFit="contain"
                                cachePolicy="memory"
                                style={{ width, height }}
                            />
                        </Pressable>
                    )}
                />
            )}

            {isChromeVisible && (
                <View
                    className="absolute inset-x-0 top-0 flex-row items-center gap-1 bg-black/60 px-2 pb-2"
                    style={{ paddingTop: insets.top + 4 }}
                >
                    <Pressable
                        onPress={() => navigation.goBack()}
                        hitSlop={8}
                        className="p-2 active:opacity-60"
                    >
                        <Icon
                            as={ChevronLeft}
                            size={26}
                            className="text-white"
                        />
                    </Pressable>
                    <View className="flex-1 items-center">
                        <Text
                            numberOfLines={1}
                            className="text-sm font-semibold text-white"
                        >
                            {place?.name ??
                                (takenAt !== null
                                    ? dateFormatter.format(takenAt)
                                    : "")}
                        </Text>
                        {takenAt !== null && (
                            <Text className="text-xs text-neutral-300">
                                {place?.name
                                    ? `${dateFormatter.format(takenAt)}, ${timeFormatter.format(takenAt)}`
                                    : timeFormatter.format(takenAt)}
                            </Text>
                        )}
                    </View>
                    <Pressable
                        onPress={() =>
                            setIsInfoVisible((isVisible) => !isVisible)
                        }
                        hitSlop={8}
                        className="p-2 active:opacity-60"
                    >
                        <Icon
                            as={Info}
                            size={22}
                            className={
                                isInfoVisible ? "text-sky-400" : "text-white"
                            }
                        />
                    </Pressable>
                </View>
            )}

            {isChromeVisible && isInfoVisible && photo && (
                <PhotoInformation
                    photo={photo}
                    place={place}
                    bottomInset={insets.bottom}
                />
            )}
        </View>
    );
}

type PhotoInformationProps = {
    photo: Photo;
    place: Place | undefined;
    bottomInset: number;
};

function PhotoInformation({
    photo,
    place,
    bottomInset,
}: PhotoInformationProps) {
    const takenAt = photo.creationTime ?? photo.modificationTime;

    return (
        <View
            className="absolute inset-x-0 bottom-0 gap-4 rounded-t-3xl bg-neutral-900/95 px-5 pt-5"
            style={{ paddingBottom: bottomInset + 20 }}
        >
            {takenAt !== null && (
                <Text className="text-base font-semibold text-white">
                    {fullDateFormatter.format(takenAt)}
                </Text>
            )}

            <View className="flex-row items-start gap-3">
                <Icon
                    as={MapPin}
                    size={18}
                    className="mt-0.5 text-neutral-400"
                />
                <View className="flex-1 gap-0.5">
                    <Text className="text-sm text-white">
                        {formatPlace(place)}
                    </Text>
                    {place?.coordinate && (
                        <Text className="text-xs text-neutral-400">
                            {place.coordinate.latitude.toFixed(5)},{" "}
                            {place.coordinate.longitude.toFixed(5)}
                        </Text>
                    )}
                </View>
            </View>

            <View className="gap-0.5">
                {photo.filename && (
                    <Text numberOfLines={1} className="text-sm text-white">
                        {photo.filename}
                    </Text>
                )}
                {photo.width !== null && photo.height !== null && (
                    <Text className="text-xs text-neutral-400">
                        {photo.width} × {photo.height} ·{" "}
                        {((photo.width * photo.height) / 1_000_000).toFixed(1)}{" "}
                        MP
                    </Text>
                )}
            </View>
        </View>
    );
}

function formatPlace(place: Place | undefined): string {
    if (place === undefined) {
        return "Locating…";
    }

    if (place.name) {
        return place.name;
    }

    return place.coordinate ? "Unknown place" : "No location";
}
