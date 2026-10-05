import { NavigationContainer } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Stack, theme } from "@/navigation";
import { AlbumScreen } from "@/screens/Album";
import { HomeScreen } from "@/screens/Home";
import { ViewerScreen } from "@/screens/Viewer";

export default function App() {
    return (
        <SafeAreaProvider>
            <NavigationContainer theme={theme}>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: "black" },
                    }}
                >
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Album" component={AlbumScreen} />
                    <Stack.Screen
                        name="Viewer"
                        component={ViewerScreen}
                        options={{ animation: "fade" }}
                    />
                </Stack.Navigator>
            </NavigationContainer>
            <PortalHost />
        </SafeAreaProvider>
    );
}
