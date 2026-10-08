import {
    Camera,
    type CameraRef,
    Map as MapView,
    Marker,
    type ViewState,
} from "@maplibre/maplibre-react-native";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { MediaThumbnail } from "@/components/MediaThumbnail";
import { Text } from "@/components/ui/text";
import type { LocatedItem } from "@/lib/database";

type PhotoMapProps = {
    items: LocatedItem[];
    topInset: number;
    bottomInset: number;
    onPressItem: (id: string) => void;
};

type Cluster = {
    key: string;
    ids: string[];
    longitude: number;
    latitude: number;
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
/** Zoom level from which markers grow and a tap cycles their photos. */
const PHOTO_ZOOM = 11;
const CLUSTER_CELL_SIZE = 96;
const CLUSTER_MARKER_SIZE = 44;
const PHOTO_MARKER_SIZE = 68;

export function PhotoMap({
    items,
    topInset,
    bottomInset,
    onPressItem,
}: PhotoMapProps) {
    const cameraRef = useRef<CameraRef>(null);
    const [viewState, setViewState] = useState<ViewState>();
    const [covers, setCovers] = useState<Record<string, number>>({});
    const zoomLevel = Math.floor(viewState?.zoom ?? 0);
    const clusters = useMemo(
        () => clusterItems(items, zoomLevel),
        [items, zoomLevel],
    );

    if (items.length === 0) {
        return (
            <View className="flex-1 items-center justify-center bg-black">
                <Text className="text-sm text-neutral-500">
                    No photos with a location yet
                </Text>
            </View>
        );
    }

    const padding = { top: topInset, bottom: bottomInset, left: 0, right: 0 };
    const [west, south, east, north] = viewState?.bounds ?? [
        -180, -90, 180, 90,
    ];
    const visibleClusters = clusters.filter(
        (cluster) =>
            cluster.longitude >= west &&
            cluster.longitude <= east &&
            cluster.latitude >= south &&
            cluster.latitude <= north,
    );
    const isPhotoZoom = zoomLevel >= PHOTO_ZOOM;
    const markerSize = isPhotoZoom ? PHOTO_MARKER_SIZE : CLUSTER_MARKER_SIZE;

    return (
        <MapView
            style={{ flex: 1 }}
            mapStyle={MAP_STYLE}
            logo={false}
            compass={false}
            attributionPosition={{ bottom: bottomInset + 8, right: 8 }}
            touchPitch={false}
            onRegionDidChange={(event) => setViewState(event.nativeEvent)}
        >
            <Camera
                ref={cameraRef}
                maxZoom={19}
                initialViewState={{
                    bounds: items.reduce(
                        ([minimumX, minimumY, maximumX, maximumY], item) => [
                            Math.min(minimumX, item.longitude),
                            Math.min(minimumY, item.latitude),
                            Math.max(maximumX, item.longitude),
                            Math.max(maximumY, item.latitude),
                        ],
                        [180, 90, -180, -90],
                    ),
                    padding: { ...padding, left: 48, right: 48 },
                }}
            />
            {visibleClusters.map((cluster) => {
                const markerKey = `${zoomLevel}:${cluster.key}`;
                const coverIndex = covers[markerKey] ?? 0;
                const coverId = cluster.ids[coverIndex % cluster.ids.length];

                return (
                    <Marker
                        key={markerKey}
                        lngLat={[cluster.longitude, cluster.latitude]}
                        anchor="bottom"
                        onPress={() => {
                            if (cluster.ids.length === 1) {
                                onPressItem(coverId);
                            } else if (isPhotoZoom) {
                                setCovers((current) => ({
                                    ...current,
                                    [markerKey]: coverIndex + 1,
                                }));
                            } else {
                                cameraRef.current?.easeTo({
                                    center: [
                                        cluster.longitude,
                                        cluster.latitude,
                                    ],
                                    zoom: zoomLevel + 2,
                                    padding,
                                    duration: 400,
                                });
                            }
                        }}
                    >
                        <View className="items-center">
                            <View
                                className="bg-white p-1 shadow-xl shadow-black"
                                style={{ borderRadius: markerSize / 4 + 4 }}
                            >
                                <MediaThumbnail
                                    uri={coverId}
                                    size={markerSize}
                                    priority="high"
                                    borderRadius={markerSize / 4}
                                />
                                {cluster.ids.length > 1 && (
                                    <View className="absolute -right-2.5 -top-2.5 min-w-7 items-center rounded-full border-2 border-white bg-neutral-900 px-1.5 py-0.5">
                                        <Text className="text-xs font-bold text-white">
                                            {cluster.ids.length}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View className="-mt-2 h-3.5 w-3.5 rotate-45 rounded-sm bg-white" />
                        </View>
                    </Marker>
                );
            })}
        </MapView>
    );
}

/**
 * Groups items that fall into the same screen cell at the given zoom level.
 * Each group is placed at the average position of its items.
 */
function clusterItems(items: LocatedItem[], zoomLevel: number): Cluster[] {
    const scale = (512 * 2 ** zoomLevel) / CLUSTER_CELL_SIZE;
    const cells = new Map<string, LocatedItem[]>();

    for (const item of items) {
        const sine = Math.sin((item.latitude * Math.PI) / 180);
        const x = Math.floor(((item.longitude + 180) / 360) * scale);
        const y = Math.floor(
            (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
        );
        const key = `${x}:${y}`;
        const members = cells.get(key);

        if (members) {
            members.push(item);
        } else {
            cells.set(key, [item]);
        }
    }

    return [...cells].map(([key, members]) => ({
        key,
        ids: members.map((item) => item.id),
        longitude:
            members.reduce((sum, item) => sum + item.longitude, 0) /
            members.length,
        latitude:
            members.reduce((sum, item) => sum + item.latitude, 0) /
            members.length,
    }));
}
