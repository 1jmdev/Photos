import { useNavigation } from "@react-navigation/native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export function DetailsScreen() {
    const navigation = useNavigation();

    return (
        <View className="flex-1 items-center justify-center gap-4 bg-black px-6">
            <Text className="text-2xl font-semibold text-white">Details</Text>
            <Button variant="secondary" onPress={() => navigation.goBack()}>
                <Text>Back</Text>
            </Button>
        </View>
    );
}
