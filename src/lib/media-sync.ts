import {
    AssetField,
    type AssetMetadata,
    Album as MediaAlbum,
    type MediaLibraryAssetsChangeEvent,
    MediaType,
    Query,
} from "expo-media-library";
import { Platform } from "react-native";

import {
    type IndexUpdate,
    type Photo,
    readIndexedPhotoIds,
    readModificationCursor,
    writeIndexUpdate,
} from "@/lib/database";

export type SyncStatus = "idle" | "indexing" | "updating";

export type SyncState = {
    /** Incremented every time the indexed photos or albums change. */
    revision: number;
    status: SyncStatus;
};

type PendingChange =
    | { kind: "full" }
    | { kind: "incremental"; insertedIds: string[]; removedIds: string[] };

type DeviceAlbum = {
    id: string;
    title: string;
    handle: MediaAlbum;
};

/** Newest photos indexed first on a fresh install so the grid appears at once. */
const FIRST_PAGE_SIZE = 400;

let syncState: SyncState = { revision: 0, status: "idle" };
const syncListeners = new Set<() => void>();

let pendingChange: PendingChange | null = null;
let isSyncRunning = false;

export function subscribeToSync(listener: () => void): () => void {
    syncListeners.add(listener);

    return () => {
        syncListeners.delete(listener);
    };
}

export function getSyncState(): SyncState {
    return syncState;
}

/**
 * Brings the index up to date after the application starts. iOS keeps no
 * record of changes made while the application was closed, so it reconciles
 * the full library; Android detects the changes incrementally.
 */
export function syncOnStart(): void {
    scheduleSync(
        Platform.OS === "ios"
            ? { kind: "full" }
            : { kind: "incremental", insertedIds: [], removedIds: [] },
    );
}

/**
 * Checks for changes made while the application was in the background. iOS
 * delivers those changes to the change listener, so only Android needs this.
 */
export function syncOnResume(): void {
    if (Platform.OS === "android") {
        scheduleSync({ kind: "incremental", insertedIds: [], removedIds: [] });
    }
}

/**
 * Applies a change event from the operating system. Only the affected photos
 * are written; the full library is read only when the system requires it.
 */
export function syncMediaLibraryChange(
    event: MediaLibraryAssetsChangeEvent,
): void {
    if (Platform.OS === "ios" && !event.hasIncrementalChanges) {
        scheduleSync({ kind: "full" });
        return;
    }

    scheduleSync({
        kind: "incremental",
        insertedIds: event.insertedAssets ?? [],
        removedIds: event.deletedAssets ?? [],
    });
}

/**
 * Queues a synchronization. Changes arriving while one is running are merged
 * and processed together once it finishes.
 */
function scheduleSync(change: PendingChange): void {
    if (!pendingChange) {
        pendingChange = change;
    } else if (pendingChange.kind === "full" || change.kind === "full") {
        pendingChange = { kind: "full" };
    } else {
        pendingChange = {
            kind: "incremental",
            insertedIds: [...pendingChange.insertedIds, ...change.insertedIds],
            removedIds: [...pendingChange.removedIds, ...change.removedIds],
        };
    }

    if (!isSyncRunning) {
        isSyncRunning = true;
        void runPendingSyncs();
    }
}

async function runPendingSyncs(): Promise<void> {
    while (pendingChange) {
        const change = pendingChange;
        pendingChange = null;

        try {
            if (change.kind === "full") {
                await runFullSync();
            } else {
                await runIncrementalSync(change.insertedIds, change.removedIds);
            }
        } catch (error) {
            console.warn("Media library synchronization failed", error);
        }
    }

    setSyncState({ ...syncState, status: "idle" });
    isSyncRunning = false;
}

async function runFullSync(): Promise<void> {
    const isFirstIndex = (await readModificationCursor()) === null;

    setSyncState({
        ...syncState,
        status: isFirstIndex ? "indexing" : "updating",
    });

    if (isFirstIndex) {
        await writeIndexUpdate({
            upsertedPhotos: await queryPhotos({ limit: FIRST_PAGE_SIZE }),
            removedPhotoIds: [],
            albums: [],
            albumPhotoIds: new Map(),
            isComplete: false,
        });
        publishChange();
    }

    const photos = await queryPhotos();
    const albums = await readDeviceAlbums();

    await writeIndexUpdate({
        upsertedPhotos: photos,
        removedPhotoIds: [],
        albums,
        albumPhotoIds: await queryAlbumPhotoIds(albums),
        isComplete: true,
    });
    publishChange();
}

async function runIncrementalSync(
    insertedIds: string[],
    removedIds: string[],
): Promise<void> {
    const cursor = await readModificationCursor();

    if (cursor === null) {
        await runFullSync();
        return;
    }

    setSyncState({ ...syncState, status: "updating" });

    const indexedIds = await readIndexedPhotoIds();
    const changedPhotos = await queryPhotos({ modifiedSince: cursor });
    const changedIds = new Set(changedPhotos.map((photo) => photo.id));
    const hasNewPhotos = changedPhotos.some(
        (photo) => !indexedIds.has(photo.id),
    );
    let removedPhotoIds = removedIds.filter((id) => indexedIds.has(id));

    if (Platform.OS === "android" && !hasNewPhotos) {
        // Android reports that the library changed but not how. When no new
        // photo was found the change was a deletion, so the identifiers are
        // compared against the media store to find the removed photos.
        const deviceIds = await queryPhotoIds();
        const deviceIdSet = new Set(deviceIds);

        if (deviceIds.some((id) => !indexedIds.has(id))) {
            // A photo with an older modification time was added, for example
            // by restoring a backup. It cannot be found incrementally.
            await runFullSync();
            return;
        }

        removedPhotoIds = [...indexedIds].filter((id) => !deviceIdSet.has(id));
    }

    if (insertedIds.some((id) => !indexedIds.has(id) && !changedIds.has(id))) {
        await runFullSync();
        return;
    }

    const hasModifiedPhotos = changedPhotos.some(
        (photo) =>
            photo.modificationTime !== null && photo.modificationTime > cursor,
    );

    if (!hasNewPhotos && !hasModifiedPhotos && removedPhotoIds.length === 0) {
        return;
    }

    const albums = await readDeviceAlbums();
    const update: IndexUpdate = {
        upsertedPhotos: changedPhotos,
        removedPhotoIds,
        albums,
        albumPhotoIds: await queryAlbumPhotoIds(albums, cursor),
        isComplete: false,
    };

    await writeIndexUpdate(update);
    publishChange();
}

/**
 * Reads image metadata straight from the system media store without
 * resolving file paths or decoding images.
 */
async function queryPhotos(
    options: {
        album?: MediaAlbum;
        modifiedSince?: number;
        limit?: number;
    } = {},
): Promise<Photo[]> {
    let query = new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false });

    if (options.album) {
        query = query.album(options.album);
    }

    if (options.modifiedSince !== undefined) {
        query = query.gte(AssetField.MODIFICATION_TIME, options.modifiedSince);
    }

    if (options.limit !== undefined) {
        query = query.limit(options.limit);
    }

    const metadata = await query.exeForMetadata();

    return metadata.map(toPhoto);
}

async function queryPhotoIds(
    options: { album?: MediaAlbum; modifiedSince?: number } = {},
): Promise<string[]> {
    const photos = await queryPhotos(options);

    return photos.map((photo) => photo.id);
}

/**
 * Reads the albums exposed by the operating system. On Android these are the
 * media folders, such as Camera, Screenshots or Download.
 */
async function readDeviceAlbums(): Promise<DeviceAlbum[]> {
    const albums = await MediaAlbum.getAll();

    return Promise.all(
        albums.map(async (album) => ({
            id: album.id,
            title: await album.getTitle(),
            handle: album,
        })),
    );
}

async function queryAlbumPhotoIds(
    albums: DeviceAlbum[],
    modifiedSince?: number,
): Promise<Map<string, string[]>> {
    const entries = await Promise.all(
        albums.map(
            async (album) =>
                [
                    album.id,
                    await queryPhotoIds({ album: album.handle, modifiedSince }),
                ] as const,
        ),
    );

    return new Map(entries);
}

function toPhoto(metadata: AssetMetadata): Photo {
    return {
        id: metadata.id,
        filename: metadata.filename,
        width: metadata.width,
        height: metadata.height,
        creationTime: metadata.creationTime,
        modificationTime: metadata.modificationTime,
    };
}

function publishChange(): void {
    setSyncState({ ...syncState, revision: syncState.revision + 1 });
}

function setSyncState(nextState: SyncState): void {
    if (
        nextState.revision === syncState.revision &&
        nextState.status === syncState.status
    ) {
        return;
    }

    syncState = nextState;

    for (const listener of syncListeners) {
        listener();
    }
}
