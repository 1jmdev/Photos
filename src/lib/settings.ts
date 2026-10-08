import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const GALLERY_COLUMNS = { small: 4, medium: 5, large: 8 };
export type GalleryScale = keyof typeof GALLERY_COLUMNS;

type Settings = {
    galleryScale: GalleryScale;
    setGalleryScale: (galleryScale: GalleryScale) => void;
};

export const useSettings = create<Settings>()(
    persist(
        (set) => ({
            galleryScale: "small",
            setGalleryScale: (galleryScale) => set({ galleryScale }),
        }),
        {
            name: "user-settings",
            storage: createJSONStorage(() => ({
                getItem: Storage.getItemSync.bind(Storage),
                setItem: Storage.setItemSync.bind(Storage),
                removeItem: Storage.removeItemSync.bind(Storage),
            })),
        },
    ),
);
