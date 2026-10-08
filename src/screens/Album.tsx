import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaGrid } from "@/components/MediaGrid";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useMediaList } from "@/hooks/use-media-items";
import type { RootStackParamList } from "@/navigation";

const HEADER_HEIGHT = 52;

export function AlbumScreen({
    navigation,
    route,
}: NativeStackScreenProps<RootStackParamList, "Album">) {
    const { source, title } = route.params;
    const insets = useSafeAreaInsets();
    const { entries } = useMediaList(source);
    const topInset = insets.top + HEADER_HEIGHT;

    return (
        <View className="flex-1 bg-black">
            <MediaGrid
                entries={entries}
                topInset={topInset}
                bottomInset={insets.bottom}
                onPressItem={(index) =>
                    navigation.navigate("Viewer", { source, index })
                }
            />

            <View
                className="absolute inset-x-0 top-0 flex-row items-center gap-1 bg-black/90 px-2"
                style={{ paddingTop: insets.top, height: topInset }}
            >
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Back to albums"
                    className="h-11 w-11 items-center justify-center active:opacity-60"
                >
                    <Icon as={ChevronLeft} size={26} className="text-white" />
                </Pressable>
                <Text
                    numberOfLines={1}
                    className="flex-1 text-lg font-semibold text-white"
                >
                    {title}
                </Text>
            </View>
        </View>
    );
}
