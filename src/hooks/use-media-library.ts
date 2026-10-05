import { addListener, usePermissions } from "expo-media-library";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Linking } from "react-native";

import {
    getSyncState,
    type SyncStatus,
    subscribeToSync,
    syncMediaLibraryChange,
    syncOnResume,
    syncOnStart,
} from "@/lib/media-sync";

export type MediaLibraryState = {
    /** `undefined` while the permission status is being read. */
    isGranted: boolean | undefined;
    syncStatus: SyncStatus;
    requestPermission: () => Promise<void>;
};

/**
 * Owns access to the system photo library: requests the permission, indexes
 * the library once it is granted and keeps the index current by listening to
 * operating system change events. Mount it once at the application root.
 */
export function useMediaLibrary(): MediaLibraryState {
    const [permission, askForPermission] = usePermissions({
        granularPermissions: ["photo"],
    });
    const { status } = useSyncExternalStore(subscribeToSync, getSyncState);
    const isGranted = permission?.granted;

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

    async function requestPermission(): Promise<void> {
        if (permission && !permission.canAskAgain) {
            await Linking.openSettings();
            return;
        }

        await askForPermission();
    }

    return {
        isGranted,
        syncStatus: status,
        requestPermission,
    };
}
