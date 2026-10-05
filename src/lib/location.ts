import {
    getForegroundPermissionsAsync,
    type LocationGeocodedAddress,
    requestForegroundPermissionsAsync,
    reverseGeocodeAsync,
} from "expo-location";
import { Asset } from "expo-media-library";

import {
    type Coordinate,
    readPhotoLocation,
    readPlaceName,
    writePhotoLocation,
    writePlaceName,
} from "@/lib/database";

export type Place = {
    coordinate: Coordinate | null;
    name: string | null;
};

/** Three decimal places group coordinates within roughly one hundred metres. */
const COORDINATE_PRECISION = 3;

/**
 * Resolves where a photo was taken. The coordinate comes from the photo
 * metadata and is turned into a place name by the platform geocoder. Both
 * results are cached, so every place is geocoded only once.
 */
export async function resolvePlace(photoId: string): Promise<Place> {
    let coordinate = await readPhotoLocation(photoId);

    if (coordinate === undefined) {
        coordinate = await readPhotoCoordinate(photoId);
        await writePhotoLocation(photoId, coordinate);
    }

    if (!coordinate) {
        return { coordinate: null, name: null };
    }

    const coordinateKey = [
        coordinate.latitude.toFixed(COORDINATE_PRECISION),
        coordinate.longitude.toFixed(COORDINATE_PRECISION),
    ].join(",");
    const cachedName = await readPlaceName(coordinateKey);

    if (cachedName) {
        return { coordinate, name: cachedName };
    }

    if (!(await hasLocationPermission())) {
        return { coordinate, name: null };
    }

    const addresses = await reverseGeocodeAsync(coordinate).catch(() => []);
    const name = addresses.length > 0 ? formatAddress(addresses[0]) : null;

    if (name) {
        await writePlaceName(coordinateKey, name);
    }

    return { coordinate, name };
}

async function readPhotoCoordinate(
    photoId: string,
): Promise<Coordinate | null> {
    try {
        const location = await new Asset(photoId).getLocation();

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

function formatAddress(address: LocationGeocodedAddress): string | null {
    const locality = address.city ?? address.subregion ?? address.region;
    const parts: string[] = [];

    for (const part of [address.district, locality, address.country]) {
        if (part && !parts.includes(part)) {
            parts.push(part);
        }
    }

    return parts.length > 0 ? parts.join(", ") : null;
}
