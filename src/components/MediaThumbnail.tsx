import { useRecyclingState } from "@shopify/flash-list";
import { Image } from "expo-image";
import { memo } from "react";

type MediaThumbnailProps = {
    uri: string;
    size: number;
    loadingEnabled: boolean;
};

export const MediaThumbnail = memo(function MediaThumbnail({
    uri,
    size,
    loadingEnabled,
}: MediaThumbnailProps) {
    const [loadedUri, setLoadedUri] = useRecyclingState<string | null>(null, [
        uri,
    ]);

    return (
        <Image
            source={
                loadingEnabled || loadedUri === uri
                    ? {
                          uri,
                          cacheKey: `thumbnail:${uri}`,
                      }
                    : null
            }
            recyclingKey={uri}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            enforceEarlyResizing
            onLoad={() => setLoadedUri(uri, true)}
            style={{ width: size, height: size, backgroundColor: "#171717" }}
        />
    );
});
