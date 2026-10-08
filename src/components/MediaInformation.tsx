import { MapPin } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { MediaItem } from "@/lib/database";
import { formatDuration, formatFullDate, formatTime } from "@/lib/format";
import type { Place } from "@/lib/location";

type MediaInformationProps = {
    item: MediaItem;
    place: Place | undefined;
    bottomInset: number;
};

export function MediaInformation({
    item,
    place,
    bottomInset,
}: MediaInformationProps) {
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
