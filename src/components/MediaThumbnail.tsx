import { Image } from "expo-image";
import { requireNativeModule } from "expo-modules-core";
import { memo, useEffect, useRef } from "react";
import { PixelRatio, Platform } from "react-native";

if (Platform.OS === "android" || Platform.OS === "ios") {
    requireNativeModule("MediaThumbnails");
}

type MediaThumbnailProps = {
    uri: string;
    size: number;
    priority: "high" | "low";
    borderRadius?: number;
};

export const MediaThumbnail = memo(function MediaThumbnail({
    uri,
    size,
    priority,
    borderRadius = 0,
}: MediaThumbnailProps) {
    const imageRef = useRef<Image>(null);
    const previousRequest = useRef({ uri, priority });
    const resolution = Math.min(
        384,
        PixelRatio.getPixelSizeForLayoutSize(size),
    );

    useEffect(() => {
        if (
            Platform.OS === "android" &&
            previousRequest.current.uri === uri &&
            previousRequest.current.priority === "low" &&
            priority === "high"
        ) {
            void imageRef.current?.reloadAsync();
        }
        previousRequest.current = { uri, priority };
    }, [uri, priority]);

    return (
        <Image
            ref={imageRef}
            source={{
                uri:
                    Platform.OS === "ios"
                        ? `gallery-thumbnail:///${encodeURIComponent(uri.slice(5))}?size=${resolution}`
                        : Platform.OS === "android"
                          ? `content://gallery-thumbnail/${encodeURIComponent(uri)}`
                          : uri,
                width: resolution,
                height: resolution,
            }}
            recyclingKey={uri}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority={priority}
            transition={0}
            enforceEarlyResizing
            style={{
                width: size,
                height: size,
                borderRadius,
                backgroundColor: "#171717",
            }}
        />
    );
});
