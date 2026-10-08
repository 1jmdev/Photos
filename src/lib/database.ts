import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

export type MediaType = "photo" | "video";

export type MediaItem = {
    id: string;
    mediaType: MediaType;
    filename: string | null;
    width: number | null;
    height: number | null;
    /** Video duration in milliseconds, `null` for photos. */
    duration: number | null;
    isFavorite: boolean;
    creationTime: number | null;
    modificationTime: number | null;
};

/** Compact entry used by grids and the viewer to list many items at once. */
export type MediaListEntry = {
    id: string;
    sortTime: number;
    duration: number | null;
    takenAt: number | null;
    isFavorite: boolean;
};

export type MediaSource =
    | { kind: "all" }
    | { kind: "videos" }
    | { kind: "favorites" }
    | { kind: "album"; albumId: string };

export type Collection = {
    source: MediaSource;
    title: string;
    itemCount: number;
    coverId: string | null;
};

export type Coordinate = {
    latitude: number;
    longitude: number;
};

export type PlaceName = {
    /** Short form such as "Nehvizdy, Czechia". */
    locality: string | null;
    /** Full form such as "Vinohradská 325, 250 81 Nehvizdy, Czechia". */
    address: string | null;
};

type MediaItemRow = {
    id: string;
    media_type: MediaType;
    filename: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    is_favorite: number;
    creation_time: number | null;
    modification_time: number | null;
};

type CollectionRow = {
    id: string;
    title: string;
    item_count: number;
    cover_id: string | null;
};

type SourceFilter = {
    join: string;
    where: string;
    parameters: string[];
};

const DATABASE_NAME = "photos.db";
const WRITE_BATCH_SIZE = 2000;

/** Device folders shown as collections instead of in the album list. */
const CAMERA_ALBUM_TITLE = "camera";
const SCREENSHOTS_ALBUM_TITLE = "screenshots";

/**
 * Schema migrations. The position in the array plus one is the schema version
 * stored in `PRAGMA user_version`. New migrations are appended, never edited.
 */
const MIGRATIONS = [
    `
    CREATE TABLE media_items (
        id TEXT PRIMARY KEY NOT NULL,
        media_type TEXT NOT NULL,
        filename TEXT,
        width INTEGER,
        height INTEGER,
        duration INTEGER,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        creation_time INTEGER,
        modification_time INTEGER,
        sort_time INTEGER NOT NULL
    );

    CREATE INDEX media_items_sort_index ON media_items (sort_time DESC, id DESC);
    CREATE INDEX media_items_modification_index ON media_items (modification_time);

    CREATE TABLE albums (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL
    );

    CREATE TABLE album_items (
        album_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        PRIMARY KEY (album_id, item_id)
    ) WITHOUT ROWID;

    CREATE INDEX album_items_item_index ON album_items (item_id);

    CREATE TABLE item_locations (
        item_id TEXT PRIMARY KEY NOT NULL,
        latitude REAL,
        longitude REAL
    );

    CREATE TABLE place_names (
        coordinate_key TEXT PRIMARY KEY NOT NULL,
        locality TEXT,
        address TEXT
    );
    `,
];

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
    databasePromise ??= openDatabase();
    return databasePromise;
}

async function openDatabase(): Promise<SQLiteDatabase> {
    const database = await openDatabaseAsync(DATABASE_NAME);

    await database.execAsync(
        "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;",
    );

    const row = await database.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
    );

    for (
        let version = row?.user_version ?? 0;
        version < MIGRATIONS.length;
        version += 1
    ) {
        await database.withTransactionAsync(async () => {
            await database.execAsync(MIGRATIONS[version]);
            await database.execAsync(`PRAGMA user_version = ${version + 1}`);
        });
    }

    return database;
}

export function getSourceKey(source: MediaSource): string {
    return source.kind === "album" ? `album:${source.albumId}` : source.kind;
}

function getSourceFilter(source: MediaSource): SourceFilter {
    switch (source.kind) {
        case "all":
            return { join: "", where: "1", parameters: [] };
        case "videos":
            return { join: "", where: "media_type = 'video'", parameters: [] };
        case "favorites":
            return { join: "", where: "is_favorite = 1", parameters: [] };
        case "album":
            return {
                join: "JOIN album_items ON album_items.item_id = media_items.id",
                where: "album_items.album_id = ?",
                parameters: [source.albumId],
            };
    }
}

/**
 * Reads the items of a source from newest to oldest. SQLite aggregates them
 * into a single JSON array, which is much faster than one row per item.
 */
export async function readMediaList(
    source: MediaSource,
): Promise<MediaListEntry[]> {
    const database = await getDatabase();
    const filter = getSourceFilter(source);
    const row = await database.getFirstAsync<{ entries: string }>(
        `SELECT json_group_array(json_array(id, sort_time, duration, taken_at, is_favorite)) AS entries
        FROM (
            SELECT media_items.id, sort_time, duration,
                COALESCE(creation_time, modification_time) AS taken_at, is_favorite
            FROM media_items
            ${filter.join}
            WHERE ${filter.where}
            ORDER BY sort_time DESC, media_items.id DESC
        )`,
        filter.parameters,
    );

    if (!row) {
        return [];
    }

    const entries = JSON.parse(row.entries) as [
        string,
        number,
        number | null,
        number | null,
        number,
    ][];

    return entries.map(([id, sortTime, duration, takenAt, isFavorite]) => ({
        id,
        sortTime,
        duration,
        takenAt,
        isFavorite: isFavorite === 1,
    }));
}

export async function readMediaItem(id: string): Promise<MediaItem | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<MediaItemRow>(
        `SELECT id, media_type, filename, width, height, duration, is_favorite,
            creation_time, modification_time
        FROM media_items WHERE id = ?`,
        id,
    );

    if (!row) {
        return null;
    }

    return {
        id: row.id,
        mediaType: row.media_type,
        filename: row.filename,
        width: row.width,
        height: row.height,
        duration: row.duration,
        isFavorite: row.is_favorite === 1,
        creationTime: row.creation_time,
        modificationTime: row.modification_time,
    };
}

/**
 * Reads the fixed collections (all items, camera, screenshots, videos and
 * favorites) followed by every other non-empty album, most recent first.
 */
export async function readCollections(): Promise<{
    collections: Collection[];
    albums: Collection[];
}> {
    const database = await getDatabase();
    const albumRows = await database.getAllAsync<CollectionRow>(
        `SELECT
            albums.id AS id,
            albums.title AS title,
            COUNT(media_items.id) AS item_count,
            (
                SELECT cover.id FROM album_items AS membership
                JOIN media_items AS cover ON cover.id = membership.item_id
                WHERE membership.album_id = albums.id
                ORDER BY cover.sort_time DESC, cover.id DESC
                LIMIT 1
            ) AS cover_id
        FROM albums
        JOIN album_items ON album_items.album_id = albums.id
        JOIN media_items ON media_items.id = album_items.item_id
        GROUP BY albums.id
        ORDER BY MAX(media_items.sort_time) DESC`,
    );
    const albums: Collection[] = albumRows.map((row) => ({
        source: { kind: "album", albumId: row.id },
        title: row.title,
        itemCount: row.item_count,
        coverId: row.cover_id,
    }));

    const cameraAlbum = albums.find(
        (album) => album.title.toLowerCase() === CAMERA_ALBUM_TITLE,
    );
    const screenshotsAlbum = albums.find(
        (album) => album.title.toLowerCase() === SCREENSHOTS_ALBUM_TITLE,
    );

    const collections = [
        await readCollection(database, { kind: "all" }, "All photos"),
        cameraAlbum,
        screenshotsAlbum,
        await readCollection(database, { kind: "videos" }, "Videos"),
        await readCollection(database, { kind: "favorites" }, "Favorites"),
    ].filter(
        (collection): collection is Collection =>
            collection !== undefined &&
            (collection.source.kind === "all" || collection.itemCount > 0),
    );

    return {
        collections,
        albums: albums.filter(
            (album) => album !== cameraAlbum && album !== screenshotsAlbum,
        ),
    };
}

async function readCollection(
    database: SQLiteDatabase,
    source: MediaSource,
    title: string,
): Promise<Collection> {
    const filter = getSourceFilter(source);
    const row = await database.getFirstAsync<{
        item_count: number;
        cover_id: string | null;
    }>(
        `SELECT
            (SELECT COUNT(*) FROM media_items ${filter.join} WHERE ${filter.where})
                AS item_count,
            (
                SELECT media_items.id FROM media_items ${filter.join}
                WHERE ${filter.where}
                ORDER BY sort_time DESC, media_items.id DESC
                LIMIT 1
            ) AS cover_id`,
        [...filter.parameters, ...filter.parameters],
    );

    return {
        source,
        title,
        itemCount: row?.item_count ?? 0,
        coverId: row?.cover_id ?? null,
    };
}

export async function readIndexedIds(): Promise<Set<string>> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ ids: string }>(
        "SELECT json_group_array(id) AS ids FROM media_items",
    );

    return new Set(row ? (JSON.parse(row.ids) as string[]) : []);
}

/**
 * Returns the newest modification time in the index. Items modified at or
 * after this time are fetched during an incremental synchronization.
 */
export async function readModificationCursor(): Promise<number | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ cursor: number | null }>(
        "SELECT MAX(modification_time) AS cursor FROM media_items",
    );

    return row?.cursor ?? null;
}

export type IndexUpdate = {
    upsertedItems: MediaItem[];
    removedIds: string[];
    albums: { id: string; title: string }[];
    albumItemIds: Map<string, string[]>;
    /**
     * When set, the update describes the complete library: items and album
     * memberships missing from it are removed.
     */
    isComplete: boolean;
};

/** Writes a synchronization result to the index in a single transaction. */
export async function writeIndexUpdate(update: IndexUpdate): Promise<void> {
    const database = await getDatabase();

    await database.withTransactionAsync(async () => {
        await upsertMediaItems(database, update.upsertedItems);

        if (update.isComplete) {
            await database.runAsync(
                `DELETE FROM media_items
                WHERE id NOT IN (SELECT value FROM json_each(?))`,
                JSON.stringify(update.upsertedItems.map((item) => item.id)),
            );
        } else {
            await deleteMediaItems(database, update.removedIds);
        }

        if (update.albums.length > 0 || update.isComplete) {
            await replaceAlbums(database, update.albums);
        }

        for (const [albumId, itemIds] of update.albumItemIds) {
            if (update.isComplete) {
                await database.runAsync(
                    "DELETE FROM album_items WHERE album_id = ?",
                    albumId,
                );
            }

            await database.runAsync(
                `INSERT OR IGNORE INTO album_items (album_id, item_id)
                SELECT ?, value FROM json_each(?)`,
                albumId,
                JSON.stringify(itemIds),
            );
        }

        await database.execAsync(`
            DELETE FROM album_items WHERE item_id NOT IN (SELECT id FROM media_items);
            DELETE FROM item_locations WHERE item_id NOT IN (SELECT id FROM media_items);
        `);
    });
}

async function upsertMediaItems(
    database: SQLiteDatabase,
    items: MediaItem[],
): Promise<void> {
    for (let start = 0; start < items.length; start += WRITE_BATCH_SIZE) {
        const batch = items
            .slice(start, start + WRITE_BATCH_SIZE)
            .map((item) => [
                item.id,
                item.mediaType,
                item.filename,
                item.width,
                item.height,
                item.duration,
                0,
                item.creationTime,
                item.modificationTime,
                item.creationTime ?? item.modificationTime ?? 0,
            ]);

        await database.runAsync(
            `INSERT INTO media_items (
                id, media_type, filename, width, height, duration, is_favorite,
                creation_time, modification_time, sort_time
            )
            SELECT
                json_extract(value, '$[0]'),
                json_extract(value, '$[1]'),
                json_extract(value, '$[2]'),
                json_extract(value, '$[3]'),
                json_extract(value, '$[4]'),
                json_extract(value, '$[5]'),
                json_extract(value, '$[6]'),
                json_extract(value, '$[7]'),
                json_extract(value, '$[8]'),
                json_extract(value, '$[9]')
            FROM json_each(?)
            WHERE true
            ON CONFLICT (id) DO UPDATE SET
                media_type = excluded.media_type,
                filename = excluded.filename,
                width = excluded.width,
                height = excluded.height,
                duration = excluded.duration,
                creation_time = excluded.creation_time,
                modification_time = excluded.modification_time,
                sort_time = excluded.sort_time`,
            JSON.stringify(batch),
        );
    }
}

async function deleteMediaItems(
    database: SQLiteDatabase,
    ids: string[],
): Promise<void> {
    for (let start = 0; start < ids.length; start += WRITE_BATCH_SIZE) {
        await database.runAsync(
            "DELETE FROM media_items WHERE id IN (SELECT value FROM json_each(?))",
            JSON.stringify(ids.slice(start, start + WRITE_BATCH_SIZE)),
        );
    }
}

async function replaceAlbums(
    database: SQLiteDatabase,
    albums: { id: string; title: string }[],
): Promise<void> {
    const serializedAlbums = JSON.stringify(
        albums.map((album) => [album.id, album.title]),
    );

    await database.runAsync(
        `INSERT INTO albums (id, title)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]')
        FROM json_each(?)
        WHERE true
        ON CONFLICT (id) DO UPDATE SET title = excluded.title`,
        serializedAlbums,
    );
    await database.runAsync(
        `DELETE FROM albums
        WHERE id NOT IN (SELECT json_extract(value, '$[0]') FROM json_each(?))`,
        serializedAlbums,
    );
    await database.runAsync(
        "DELETE FROM album_items WHERE album_id NOT IN (SELECT id FROM albums)",
    );
}

/**
 * Returns the cached coordinate of an item. `null` means the item is known to
 * have no location; `undefined` means it has not been read yet.
 */
export async function readItemLocation(
    itemId: string,
): Promise<Coordinate | null | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{
        latitude: number | null;
        longitude: number | null;
    }>(
        "SELECT latitude, longitude FROM item_locations WHERE item_id = ?",
        itemId,
    );

    if (!row) {
        return undefined;
    }

    if (row.latitude === null || row.longitude === null) {
        return null;
    }

    return { latitude: row.latitude, longitude: row.longitude };
}

export async function writeItemLocation(
    itemId: string,
    coordinate: Coordinate | null,
): Promise<void> {
    const database = await getDatabase();

    await database.runAsync(
        `INSERT INTO item_locations (item_id, latitude, longitude)
        VALUES (?, ?, ?)
        ON CONFLICT (item_id) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude`,
        itemId,
        coordinate?.latitude ?? null,
        coordinate?.longitude ?? null,
    );
}

export async function readPlaceName(
    coordinateKey: string,
): Promise<PlaceName | null> {
    const database = await getDatabase();

    return database.getFirstAsync<PlaceName>(
        "SELECT locality, address FROM place_names WHERE coordinate_key = ?",
        coordinateKey,
    );
}

export async function writePlaceName(
    coordinateKey: string,
    placeName: PlaceName,
): Promise<void> {
    const database = await getDatabase();

    await database.runAsync(
        `INSERT INTO place_names (coordinate_key, locality, address)
        VALUES (?, ?, ?)
        ON CONFLICT (coordinate_key) DO UPDATE SET
            locality = excluded.locality,
            address = excluded.address`,
        coordinateKey,
        placeName.locality,
        placeName.address,
    );
}
