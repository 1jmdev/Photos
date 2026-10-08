import { useEffect, useState } from "react";

import {
    type Collection,
    getSourceKey,
    type MediaItem,
    type MediaListEntry,
    type MediaSource,
    readCollections,
    readMediaItem,
    readMediaList,
} from "@/lib/database";
import { type Place, resolvePlace } from "@/lib/location";
import { useMediaSync } from "@/lib/media-sync";

type CachedMediaList = {
    key: string;
    revision: number;
    entries: MediaListEntry[];
};

const EMPTY_ENTRIES: MediaListEntry[] = [];

/**
 * Lists shared between screens, so the viewer opened from a grid reuses the
 * list already in memory and can show the selected item immediately.
 */
const mediaListCache = new Map<string, CachedMediaList>();

/**
 * Returns the items of a source ordered from newest to oldest. The list is
 * reloaded from the local index whenever the library changes.
 */
export function useMediaList(source: MediaSource): {
    entries: MediaListEntry[];
    isLoaded: boolean;
} {
    const key = getSourceKey(source);
    const revision = useMediaSync((state) => state.revision);
    const [list, setList] = useState(() => mediaListCache.get(key) ?? null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: the source is fully described by its key.
    useEffect(() => {
        const cachedList = mediaListCache.get(key);

        if (cachedList?.revision === revision) {
            setList(cachedList);
            return;
        }

        let isActive = true;

        readMediaList(source)
            .then((entries) => {
                const nextList = { key, revision, entries };

                mediaListCache.set(key, nextList);

                if (isActive) {
                    setList(nextList);
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading media list failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [key, revision]);

    if (list?.key !== key) {
        return { entries: EMPTY_ENTRIES, isLoaded: false };
    }

    return { entries: list.entries, isLoaded: true };
}

/**
 * Returns the fixed collections and the remaining albums, or `undefined`
 * while they load.
 */
export function useCollections():
    | { collections: Collection[]; albums: Collection[] }
    | undefined {
    const revision = useMediaSync((state) => state.revision);
    const [result, setResult] =
        useState<Awaited<ReturnType<typeof readCollections>>>();

    // biome-ignore lint/correctness/useExhaustiveDependencies: collections are reloaded whenever the index revision changes.
    useEffect(() => {
        let isActive = true;

        readCollections()
            .then((nextResult) => {
                if (isActive) {
                    setResult(nextResult);
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading collections failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [revision]);

    return result;
}

export type MediaDetails = {
    item: MediaItem | null;
    /** `undefined` while the location is being read and geocoded. */
    place: Place | undefined;
};

/** Returns the stored metadata of an item and the place where it was taken. */
export function useMediaDetails(itemId: string | undefined): MediaDetails {
    const revision = useMediaSync((state) => state.revision);
    const [details, setDetails] = useState<
        (MediaDetails & { itemId: string; revision: number }) | null
    >(null);

    useEffect(() => {
        if (!itemId) {
            return;
        }

        let isActive = true;

        readMediaItem(itemId)
            .then((item) => {
                if (isActive) {
                    setDetails({ itemId, revision, item, place: undefined });
                }

                return resolvePlace(itemId);
            })
            .then((place) => {
                if (isActive) {
                    setDetails((current) =>
                        current?.itemId === itemId
                            ? { ...current, place }
                            : current,
                    );
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading media details failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [itemId, revision]);

    if (!details || details.itemId !== itemId) {
        return { item: null, place: undefined };
    }

    return { item: details.item, place: details.place };
}
