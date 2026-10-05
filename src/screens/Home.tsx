import { useNavigation } from "@react-navigation/native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export function HomeScreen() {
    const navigation = useNavigation();

    return (
        <View className="flex-1 items-center justify-center gap-6 bg-black px-6">
            <Text className="text-3xl font-bold text-white">Welcome</Text>

            <Button onPress={() => navigation.navigate("Details")}>
                <Text>Open details</Text>
            </Button>
        </View>
    );
}
