import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DismissibleViewer } from "@/components/DismissibleViewer";
import { MediaInformation } from "@/components/MediaInformation";
import { Navbar } from "@/components/Navbar";
import { VideoPlayback } from "@/components/VideoPlayback";
import { useMediaDetails, useMediaList } from "@/hooks/use-media-items";
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
        </DismissibleViewer>
    );
}
