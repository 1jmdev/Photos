import { DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { MediaSource } from "@/lib/database";

export type RootStackParamList = {
    Home: undefined;
    Album: { source: MediaSource; title: string };
    Viewer: { source: MediaSource; index: number; focusId?: string };
    Editor: { id: string };
};

declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {}
    }
}

export const Stack = createNativeStackNavigator<RootStackParamList>();

export const theme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: "black" },
};
