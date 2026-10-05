import { useEffect, useState, useSyncExternalStore } from "react";

import {
    type Album,
    type Photo,
    readAlbums,
    readPhoto,
    readPhotoIds,
} from "@/lib/database";
import { type Place, resolvePlace } from "@/lib/location";
import { getSyncState, subscribeToSync } from "@/lib/media-sync";

type PhotoIdList = {
    key: string;
    revision: number;
    ids: string[];
};

const ALL_PHOTOS_KEY = "all";
const EMPTY_IDS: string[] = [];

/**
 * Photo lists shared between screens, so the viewer opened from a grid reuses
 * the list already in memory and can show the selected photo immediately.
 */
const photoIdCache = new Map<string, PhotoIdList>();

function useRevision(): number {
    return useSyncExternalStore(subscribeToSync, getSyncState).revision;
}

/**
 * Returns photo identifiers ordered from newest to oldest, for the whole
 * library or for one album. Reloaded from the index after each change.
 */
export function usePhotoIds(albumId?: string): {
    ids: string[];
    isLoaded: boolean;
} {
    const key = albumId ?? ALL_PHOTOS_KEY;
    const revision = useRevision();
    const [list, setList] = useState(() => photoIdCache.get(key) ?? null);

    useEffect(() => {
        const cachedList = photoIdCache.get(key);

        if (cachedList?.revision === revision) {
            setList(cachedList);
            return;
        }

        let isActive = true;

        readPhotoIds(albumId)
            .then((ids) => {
                const nextList = { key, revision, ids };

                photoIdCache.set(key, nextList);

                if (isActive) {
                    setList(nextList);
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading photos failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [albumId, key, revision]);

    if (list?.key !== key) {
        return { ids: EMPTY_IDS, isLoaded: false };
    }

    return { ids: list.ids, isLoaded: true };
}

/** Returns all non-empty albums, or `undefined` while they load. */
export function useAlbums(): Album[] | undefined {
    const revision = useRevision();
    const [albums, setAlbums] = useState<Album[]>();

    // biome-ignore lint/correctness/useExhaustiveDependencies: albums are reloaded whenever the index revision changes.
    useEffect(() => {
        let isActive = true;

        readAlbums()
            .then((nextAlbums) => {
                if (isActive) {
                    setAlbums(nextAlbums);
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading albums failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [revision]);

    return albums;
}

export type PhotoDetails = {
    photo: Photo | null;
    /** `undefined` while the location is being read and geocoded. */
    place: Place | undefined;
};

/** Returns the stored metadata of a photo and the place where it was taken. */
export function usePhotoDetails(photoId: string | undefined): PhotoDetails {
    const [details, setDetails] = useState<
        (PhotoDetails & { photoId: string }) | null
    >(null);

    useEffect(() => {
        if (!photoId) {
            return;
        }

        let isActive = true;

        readPhoto(photoId)
            .then((photo) => {
                if (isActive) {
                    setDetails({ photoId, photo, place: undefined });
                }

                return resolvePlace(photoId);
            })
            .then((place) => {
                if (isActive) {
                    setDetails((current) =>
                        current?.photoId === photoId
                            ? { ...current, place }
                            : current,
                    );
                }
            })
            .catch((error: unknown) => {
                console.warn("Reading photo details failed", error);
            });

        return () => {
            isActive = false;
        };
    }, [photoId]);

    if (!details || details.photoId !== photoId) {
        return { photo: null, place: undefined };
    }

    return { photo: details.photo, place: details.place };
}
