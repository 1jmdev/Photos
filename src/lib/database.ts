import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

export type Photo = {
    id: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    creationTime: number | null;
    modificationTime: number | null;
};

export type Album = {
    id: string;
    title: string;
    photoCount: number;
    coverPhotoId: string;
};

export type Coordinate = {
    latitude: number;
    longitude: number;
};

type PhotoRow = {
    id: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    creation_time: number | null;
    modification_time: number | null;
};

type AlbumRow = {
    id: string;
    title: string;
    photo_count: number;
    cover_photo_id: string;
};

type PhotoLocationRow = {
    latitude: number | null;
    longitude: number | null;
};

const DATABASE_NAME = "photos.db";
const WRITE_BATCH_SIZE = 2000;

/**
 * Schema migrations. The position in the array plus one is the schema version
 * stored in `PRAGMA user_version`. New migrations are appended, never edited.
 */
const MIGRATIONS = [
    `
    CREATE TABLE photos (
        id TEXT PRIMARY KEY NOT NULL,
        filename TEXT,
        width INTEGER,
        height INTEGER,
        creation_time INTEGER,
        modification_time INTEGER,
        sort_time INTEGER NOT NULL
    );

    CREATE INDEX photos_sort_time_index ON photos (sort_time DESC, id DESC);
    CREATE INDEX photos_modification_time_index ON photos (modification_time);

    CREATE TABLE albums (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL
    );

    CREATE TABLE album_photos (
        album_id TEXT NOT NULL,
        photo_id TEXT NOT NULL,
        PRIMARY KEY (album_id, photo_id)
    ) WITHOUT ROWID;

    CREATE INDEX album_photos_photo_index ON album_photos (photo_id);

    CREATE TABLE photo_locations (
        photo_id TEXT PRIMARY KEY NOT NULL,
        latitude REAL,
        longitude REAL
    );

    CREATE TABLE place_names (
        coordinate_key TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
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

/**
 * Reads photo identifiers from newest to oldest. SQLite aggregates them into a
 * single JSON array, which is much faster than transferring one row per photo.
 */
export async function readPhotoIds(albumId?: string): Promise<string[]> {
    const database = await getDatabase();
    const row = albumId
        ? await database.getFirstAsync<{ ids: string }>(
              `SELECT json_group_array(id) AS ids FROM (
                  SELECT photos.id FROM album_photos
                  JOIN photos ON photos.id = album_photos.photo_id
                  WHERE album_photos.album_id = ?
                  ORDER BY photos.sort_time DESC, photos.id DESC
              )`,
              albumId,
          )
        : await database.getFirstAsync<{ ids: string }>(
              `SELECT json_group_array(id) AS ids FROM (
                  SELECT id FROM photos ORDER BY sort_time DESC, id DESC
              )`,
          );

    return row ? (JSON.parse(row.ids) as string[]) : [];
}

export async function readPhoto(id: string): Promise<Photo | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<PhotoRow>(
        `SELECT id, filename, width, height, creation_time, modification_time
        FROM photos WHERE id = ?`,
        id,
    );

    if (!row) {
        return null;
    }

    return {
        id: row.id,
        filename: row.filename,
        width: row.width,
        height: row.height,
        creationTime: row.creation_time,
        modificationTime: row.modification_time,
    };
}

/**
 * Reads all non-empty albums, most recently updated first, each with its
 * newest photo as the cover.
 */
export async function readAlbums(): Promise<Album[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<AlbumRow>(
        `SELECT
            albums.id AS id,
            albums.title AS title,
            COUNT(photos.id) AS photo_count,
            (
                SELECT cover.id FROM album_photos AS membership
                JOIN photos AS cover ON cover.id = membership.photo_id
                WHERE membership.album_id = albums.id
                ORDER BY cover.sort_time DESC, cover.id DESC
                LIMIT 1
            ) AS cover_photo_id
        FROM albums
        JOIN album_photos ON album_photos.album_id = albums.id
        JOIN photos ON photos.id = album_photos.photo_id
        GROUP BY albums.id
        ORDER BY MAX(photos.sort_time) DESC`,
    );

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        photoCount: row.photo_count,
        coverPhotoId: row.cover_photo_id,
    }));
}

export async function readIndexedPhotoIds(): Promise<Set<string>> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ ids: string }>(
        "SELECT json_group_array(id) AS ids FROM photos",
    );

    return new Set(row ? (JSON.parse(row.ids) as string[]) : []);
}

/**
 * Returns the newest modification time in the index. Photos modified at or
 * after this time are fetched during an incremental synchronization.
 */
export async function readModificationCursor(): Promise<number | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ cursor: number | null }>(
        "SELECT MAX(modification_time) AS cursor FROM photos",
    );

    return row?.cursor ?? null;
}

export type IndexUpdate = {
    upsertedPhotos: Photo[];
    removedPhotoIds: string[];
    albums: { id: string; title: string }[];
    albumPhotoIds: Map<string, string[]>;
    /**
     * When set, the update describes the complete library: photos and album
     * memberships missing from it are removed.
     */
    isComplete: boolean;
};

/** Writes a synchronization result to the index in a single transaction. */
export async function writeIndexUpdate(update: IndexUpdate): Promise<void> {
    const database = await getDatabase();

    await database.withTransactionAsync(async () => {
        await upsertPhotos(database, update.upsertedPhotos);

        if (update.isComplete) {
            await database.runAsync(
                `DELETE FROM photos
                WHERE id NOT IN (SELECT value FROM json_each(?))`,
                JSON.stringify(update.upsertedPhotos.map((photo) => photo.id)),
            );
        } else {
            await deletePhotos(database, update.removedPhotoIds);
        }

        await replaceAlbums(database, update.albums);

        for (const [albumId, photoIds] of update.albumPhotoIds) {
            if (update.isComplete) {
                await database.runAsync(
                    "DELETE FROM album_photos WHERE album_id = ?",
                    albumId,
                );
            }

            await database.runAsync(
                `INSERT OR IGNORE INTO album_photos (album_id, photo_id)
                SELECT ?, value FROM json_each(?)`,
                albumId,
                JSON.stringify(photoIds),
            );
        }

        await database.execAsync(`
            DELETE FROM album_photos WHERE photo_id NOT IN (SELECT id FROM photos);
            DELETE FROM photo_locations WHERE photo_id NOT IN (SELECT id FROM photos);
        `);
    });
}

async function upsertPhotos(
    database: SQLiteDatabase,
    photos: Photo[],
): Promise<void> {
    for (let start = 0; start < photos.length; start += WRITE_BATCH_SIZE) {
        const batch = photos
            .slice(start, start + WRITE_BATCH_SIZE)
            .map((photo) => [
                photo.id,
                photo.filename,
                photo.width,
                photo.height,
                photo.creationTime,
                photo.modificationTime,
                photo.creationTime ?? photo.modificationTime ?? 0,
            ]);

        await database.runAsync(
            `INSERT INTO photos (
                id, filename, width, height, creation_time, modification_time, sort_time
            )
            SELECT
                json_extract(value, '$[0]'),
                json_extract(value, '$[1]'),
                json_extract(value, '$[2]'),
                json_extract(value, '$[3]'),
                json_extract(value, '$[4]'),
                json_extract(value, '$[5]'),
                json_extract(value, '$[6]')
            FROM json_each(?)
            WHERE true
            ON CONFLICT (id) DO UPDATE SET
                filename = excluded.filename,
                width = excluded.width,
                height = excluded.height,
                creation_time = excluded.creation_time,
                modification_time = excluded.modification_time,
                sort_time = excluded.sort_time`,
            JSON.stringify(batch),
        );
    }
}

async function deletePhotos(
    database: SQLiteDatabase,
    ids: string[],
): Promise<void> {
    for (let start = 0; start < ids.length; start += WRITE_BATCH_SIZE) {
        await database.runAsync(
            "DELETE FROM photos WHERE id IN (SELECT value FROM json_each(?))",
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
        "DELETE FROM album_photos WHERE album_id NOT IN (SELECT id FROM albums)",
    );
}

/**
 * Returns the cached coordinate of a photo. `null` means the photo is known to
 * have no location; `undefined` means it has not been read yet.
 */
export async function readPhotoLocation(
    photoId: string,
): Promise<Coordinate | null | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<PhotoLocationRow>(
        "SELECT latitude, longitude FROM photo_locations WHERE photo_id = ?",
        photoId,
    );

    if (!row) {
        return undefined;
    }

    if (row.latitude === null || row.longitude === null) {
        return null;
    }

    return { latitude: row.latitude, longitude: row.longitude };
}

export async function writePhotoLocation(
    photoId: string,
    coordinate: Coordinate | null,
): Promise<void> {
    const database = await getDatabase();

    await database.runAsync(
        `INSERT INTO photo_locations (photo_id, latitude, longitude)
        VALUES (?, ?, ?)
        ON CONFLICT (photo_id) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude`,
        photoId,
        coordinate?.latitude ?? null,
        coordinate?.longitude ?? null,
    );
}

export async function readPlaceName(
    coordinateKey: string,
): Promise<string | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ name: string }>(
        "SELECT name FROM place_names WHERE coordinate_key = ?",
        coordinateKey,
    );

    return row?.name ?? null;
}

export async function writePlaceName(
    coordinateKey: string,
    name: string,
): Promise<void> {
    const database = await getDatabase();

    await database.runAsync(
        `INSERT INTO place_names (coordinate_key, name)
        VALUES (?, ?)
        ON CONFLICT (coordinate_key) DO UPDATE SET name = excluded.name`,
        coordinateKey,
        name,
    );
}
