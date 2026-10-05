import { NavigationContainer } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";

import { Stack, theme } from "@/navigation";
import { DetailsScreen } from "@/screens/Details";
import { HomeScreen } from "@/screens/Home";

export default function App() {
    return (
        <>
            <NavigationContainer theme={theme}>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: "black" },
                    }}
                >
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Details" component={DetailsScreen} />
                </Stack.Navigator>
            </NavigationContainer>
            <PortalHost />
        </>
    );
}
