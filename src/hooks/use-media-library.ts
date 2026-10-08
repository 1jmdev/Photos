import {
    getForegroundPermissionsAsync,
    requestForegroundPermissionsAsync,
} from "expo-location";
import { addListener, usePermissions } from "expo-media-library";
import { useEffect } from "react";
import { AppState } from "react-native";

import {
    type SyncStatus,
    syncMediaLibraryChange,
    syncOnResume,
    syncOnStart,
    useMediaSync,
} from "@/lib/media-sync";

export type MediaLibraryState = {
    /** `undefined` while the permission status is being read. */
    isGranted: boolean | undefined;
    syncStatus: SyncStatus;
};

/**
 * Owns access to the system photo library: requests the permission, indexes
 * the library once it is granted and keeps the index current by listening to
 * operating system change events. Mount it once at the application root.
 */
export function useMediaLibrary(): MediaLibraryState {
    const [permission, askForPermission] = usePermissions({
        granularPermissions: ["photo", "video"],
    });
    const status = useMediaSync((state) => state.status);
    const isGranted = permission?.granted;

    useEffect(() => {
        if (!permission) {
            return;
        }

        if (permission.status === "undetermined") {
            void askForPermission();
        } else {
            void getForegroundPermissionsAsync().then((locationPermission) => {
                if (locationPermission.status === "undetermined") {
                    return requestForegroundPermissionsAsync();
                }
            });
        }
    }, [permission, askForPermission]);

    useEffect(() => {
        if (!isGranted) {
            return;
        }

        syncOnStart();

        const changeSubscription = addListener(syncMediaLibraryChange);
        const appStateSubscription = AppState.addEventListener(
            "change",
            (state) => {
                if (state === "active") {
                    syncOnResume();
                }
            },
        );

        return () => {
            changeSubscription.remove();
            appStateSubscription.remove();
        };
    }, [isGranted]);

    return {
        isGranted,
        syncStatus: status,
    };
}
