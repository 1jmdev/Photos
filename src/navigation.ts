import { DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

export type RootStackParamList = {
    Home: undefined;
    Details: undefined;
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
