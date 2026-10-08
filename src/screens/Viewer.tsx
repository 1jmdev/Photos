import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Navbar } from "@/components/Navbar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VideoPlayback } from "@/components/VideoPlayback";
import { useMediaDetails, useMediaList } from "@/hooks/use-media-items";
import type { MediaItem } from "@/lib/database";
import { formatDuration, formatFullDate, formatTime } from "@/lib/format";
import type { Place } from "@/lib/location";
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
        <View className="flex-1 bg-black">
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
                <Navbar
                    takenAt={takenAt}
                    isInfoVisible={isInfoVisible}
                    onBack={() => navigation.goBack()}
                    onToggleInfo={() =>
                        setIsInfoVisible((isVisible) => !isVisible)
                    }
                />
            )}

            {isChromeVisible && isInfoVisible && item && (
                <MediaInformation
                    item={item}
                    place={place}
                    bottomInset={insets.bottom}
                />
            )}
        </View>
    );
}

type MediaInformationProps = {
    item: MediaItem;
    place: Place | undefined;
    bottomInset: number;
};

function MediaInformation({ item, place, bottomInset }: MediaInformationProps) {
    const takenAt = item.creationTime ?? item.modificationTime;

    return (
        <View
            className="absolute inset-x-0 bottom-0 gap-4 rounded-t-3xl bg-neutral-900/95 px-5 pt-5"
            style={{ paddingBottom: bottomInset + 20 }}
        >
            {takenAt !== null && (
                <Text className="text-base font-semibold text-white">
                    {formatFullDate(takenAt)}, {formatTime(takenAt)}
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
                        {describePlace(place)}
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
                {item.filename && (
                    <Text numberOfLines={1} className="text-sm text-white">
                        {item.filename}
                    </Text>
                )}
                <Text className="text-xs text-neutral-400">
                    {describeDimensions(item)}
                </Text>
            </View>
        </View>
    );
}

function describePlace(place: Place | undefined): string {
    if (place === undefined) {
        return "Locating…";
    }

    if (place.address) {
        return place.address;
    }

    return place.coordinate ? "Unknown place" : "No location";
}

function describeDimensions(item: MediaItem): string {
    const parts: string[] = [];

    if (item.width !== null && item.height !== null) {
        parts.push(`${item.width} × ${item.height}`);

        if (item.mediaType === "photo") {
            const megapixels = (item.width * item.height) / 1_000_000;

            parts.push(`${megapixels.toFixed(1)} MP`);
        }
    }

    if (item.duration !== null) {
        parts.push(formatDuration(item.duration));
    }

    return parts.join(" · ");
}
