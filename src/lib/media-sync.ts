import {
    AssetField,
    type AssetMetadata,
    Album as DeviceAlbumHandle,
    MediaType as DeviceMediaType,
    type MediaLibraryAssetsChangeEvent,
    Query,
} from "expo-media-library";
import { Platform } from "react-native";

import {
    type IndexUpdate,
    type MediaItem,
    readIndexedIds,
    readModificationCursor,
    writeIndexUpdate,
} from "@/lib/database";

export type SyncStatus = "idle" | "indexing" | "updating";

export type SyncState = {
    /** Incremented every time the indexed items or albums change. */
    revision: number;
    status: SyncStatus;
};

type PendingChange =
    | { kind: "full" }
    | { kind: "incremental"; insertedIds: string[]; removedIds: string[] };

type DeviceAlbum = {
    id: string;
    title: string;
    handle: DeviceAlbumHandle;
};

type DeviceQueryOptions = {
    album?: DeviceAlbumHandle;
    modifiedSince?: number;
    limit?: number;
};

/** Newest items indexed first on a fresh install so the grid appears at once. */
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
 * Applies a change event from the operating system. Only the affected items
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
            upsertedItems: await queryDeviceItems({ limit: FIRST_PAGE_SIZE }),
            removedIds: [],
            albums: [],
            albumItemIds: new Map(),
            isComplete: false,
        });
        publishChange();
    }

    const items = await queryDeviceItems();
    const albums = await readDeviceAlbums();

    await writeIndexUpdate({
        upsertedItems: items,
        removedIds: [],
        albums,
        albumItemIds: await queryAlbumItemIds(albums),
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

    const indexedIds = await readIndexedIds();
    const changedItems = await queryDeviceItems({ modifiedSince: cursor });
    const changedIds = new Set(changedItems.map((item) => item.id));
    const hasNewItems = changedItems.some((item) => !indexedIds.has(item.id));
    let confirmedRemovedIds = removedIds.filter((id) => indexedIds.has(id));

    if (Platform.OS === "android" && !hasNewItems) {
        // Android reports that the library changed but not how. When no new
        // item was found the change was a deletion, so the identifiers are
        // compared against the media store to find the removed items.
        const deviceIds = (await queryDeviceItems()).map((item) => item.id);
        const deviceIdSet = new Set(deviceIds);

        if (deviceIds.some((id) => !indexedIds.has(id))) {
            // An item with an older modification time was added, for example
            // by restoring a backup. It cannot be found incrementally.
            await runFullSync();
            return;
        }

        confirmedRemovedIds = [...indexedIds].filter(
            (id) => !deviceIdSet.has(id),
        );
    }

    if (insertedIds.some((id) => !indexedIds.has(id) && !changedIds.has(id))) {
        await runFullSync();
        return;
    }

    const hasModifiedItems = changedItems.some(
        (item) =>
            item.modificationTime !== null && item.modificationTime > cursor,
    );

    if (!hasNewItems && !hasModifiedItems && confirmedRemovedIds.length === 0) {
        return;
    }

    const albums = await readDeviceAlbums();
    const update: IndexUpdate = {
        upsertedItems: changedItems,
        removedIds: confirmedRemovedIds,
        albums,
        albumItemIds: await queryAlbumItemIds(albums, cursor),
        isComplete: false,
    };

    await writeIndexUpdate(update);
    publishChange();
}

/**
 * Reads photo and video metadata straight from the system media store without
 * resolving file paths or decoding files.
 */
async function queryDeviceItems(
    options: DeviceQueryOptions = {},
): Promise<MediaItem[]> {
    let query = new Query()
        .within(AssetField.MEDIA_TYPE, [
            DeviceMediaType.IMAGE,
            DeviceMediaType.VIDEO,
        ])
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

    return metadata.map(toMediaItem);
}

/**
 * Reads the albums exposed by the operating system. On Android these are the
 * media folders, such as Camera, Screenshots or Download.
 */
async function readDeviceAlbums(): Promise<DeviceAlbum[]> {
    const albums = await DeviceAlbumHandle.getAll();

    return Promise.all(
        albums.map(async (album) => ({
            id: album.id,
            title: await album.getTitle(),
            handle: album,
        })),
    );
}

async function queryAlbumItemIds(
    albums: DeviceAlbum[],
    modifiedSince?: number,
): Promise<Map<string, string[]>> {
    const entries = await Promise.all(
        albums.map(async (album) => {
            const items = await queryDeviceItems({
                album: album.handle,
                modifiedSince,
            });

            return [album.id, items.map((item) => item.id)] as const;
        }),
    );

    return new Map(entries);
}

function toMediaItem(metadata: AssetMetadata): MediaItem {
    const isVideo = metadata.mediaType === DeviceMediaType.VIDEO;

    return {
        id: metadata.id,
        mediaType: isVideo ? "video" : "photo",
        filename: metadata.filename,
        width: metadata.width,
        height: metadata.height,
        duration: isVideo ? metadata.duration : null,
        isFavorite: metadata.isFavorite,
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
