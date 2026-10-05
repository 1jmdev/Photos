import {
    getForegroundPermissionsAsync,
    type LocationGeocodedAddress,
    requestForegroundPermissionsAsync,
    reverseGeocodeAsync,
} from "expo-location";
import { Asset } from "expo-media-library";

import {
    type Coordinate,
    type PlaceName,
    readItemLocation,
    readPlaceName,
    writeItemLocation,
    writePlaceName,
} from "@/lib/database";

export type Place = PlaceName & {
    coordinate: Coordinate | null;
};

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
        await writeItemLocation(itemId, coordinate);
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

    if (!(await hasLocationPermission())) {
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

async function readItemCoordinate(itemId: string): Promise<Coordinate | null> {
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

async function hasLocationPermission(): Promise<boolean> {
    const permission = await getForegroundPermissionsAsync();

    if (permission.granted || !permission.canAskAgain) {
        return permission.granted;
    }

    const request = await requestForegroundPermissionsAsync();

    return request.granted;
}

/**
 * Produces "Nehvizdy, Czechia" as the locality and
 * "Vinohradská 325, 250 81 Nehvizdy, Czechia" as the address.
 */
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
