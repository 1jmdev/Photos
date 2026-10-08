import {
    getForegroundPermissionsAsync,
    type LocationGeocodedAddress,
    reverseGeocodeAsync,
} from "expo-location";
import { Asset } from "expo-media-library";
import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

import {
    type Coordinate,
    type PlaceName,
    readItemLocation,
    readPlaceName,
    writeItemLocations,
    writePlaceName,
} from "@/lib/database";

export type Place = PlaceName & {
    coordinate: Coordinate | null;
};

/** Reads photo coordinates in bulk from file metadata on Android. */
const MediaLocations =
    Platform.OS === "android"
        ? requireNativeModule<{
              readLocations(ids: string[]): Promise<number[]>;
          }>("MediaLocations")
        : null;

/** Four decimal places group coordinates within roughly ten metres. */
const COORDINATE_PRECISION = 4;

const UNKNOWN_PLACE: Place = {
    coordinate: null,
    locality: null,
    address: null,
};

/**
 * Resolves where an item was taken. The coordinate comes from the item
 * metadata and is turned into a place name by the platform geocoder. Both
 * results are cached, so every place is geocoded only once.
 */
export async function resolvePlace(itemId: string): Promise<Place> {
    let coordinate = await readItemLocation(itemId);

    if (coordinate === undefined) {
        coordinate = await readItemCoordinate(itemId);
        await writeItemLocations([{ id: itemId, coordinate }]);
    }

    if (!coordinate) {
        return UNKNOWN_PLACE;
    }

    const coordinateKey = [
        coordinate.latitude.toFixed(COORDINATE_PRECISION),
        coordinate.longitude.toFixed(COORDINATE_PRECISION),
    ].join(",");
    const cachedName = await readPlaceName(coordinateKey);

    if (cachedName) {
        return { coordinate, ...cachedName };
    }

    if (!(await getForegroundPermissionsAsync()).granted) {
        return { coordinate, locality: null, address: null };
    }

    const addresses = await reverseGeocodeAsync(coordinate).catch(() => []);

    if (addresses.length === 0) {
        return { coordinate, locality: null, address: null };
    }

    const placeName = formatPlaceName(addresses[0]);

    await writePlaceName(coordinateKey, placeName);

    return { coordinate, ...placeName };
}

export async function readItemCoordinate(
    itemId: string,
): Promise<Coordinate | null> {
    try {
        const location = await new Asset(itemId).getLocation();

        if (
            !location ||
            (location.latitude === 0 && location.longitude === 0)
        ) {
            return null;
        }

        return { latitude: location.latitude, longitude: location.longitude };
    } catch {
        return null;
    }
}

/**
 * Reads the coordinates of many items at once. Android parses the metadata
 * natively in parallel; other platforms read every item separately.
 */
export async function readItemCoordinates(
    itemIds: string[],
): Promise<(Coordinate | null)[]> {
    if (!MediaLocations) {
        return Promise.all(itemIds.map(readItemCoordinate));
    }

    const coordinates = await MediaLocations.readLocations(itemIds);

    return itemIds.map((_, index) => {
        const latitude = coordinates[index * 2];
        const longitude = coordinates[index * 2 + 1];

        return Number.isNaN(latitude) || (latitude === 0 && longitude === 0)
            ? null
            : { latitude, longitude };
    });
}

function formatPlaceName(address: LocationGeocodedAddress): PlaceName {
    const city = address.city ?? address.subregion ?? address.region;
    const street = joinParts([address.street, address.streetNumber], " ");
    const cityWithPostalCode = joinParts([address.postalCode, city], " ");

    return {
        locality: joinParts([city, address.country], ", "),
        address: joinParts([street, cityWithPostalCode, address.country], ", "),
    };
}

function joinParts(
    parts: (string | null | undefined)[],
    separator: string,
): string | null {
    const presentParts = parts.filter((part): part is string => Boolean(part));

    return presentParts.length > 0 ? presentParts.join(separator) : null;
}
