import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoGrid } from "@/components/PhotoGrid";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePhotoIds } from "@/hooks/use-photos";
import type { RootStackParamList } from "@/navigation";

const HEADER_HEIGHT = 52;

export function AlbumScreen({
    navigation,
    route,
}: NativeStackScreenProps<RootStackParamList, "Album">) {
    const { albumId, title } = route.params;
    const insets = useSafeAreaInsets();
    const { ids, isLoaded } = usePhotoIds(albumId);
    const topInset = insets.top + HEADER_HEIGHT;

    return (
        <View className="flex-1 bg-black">
            <PhotoGrid
                ids={ids}
                topInset={topInset}
                bottomInset={insets.bottom}
                onPressPhoto={(index) =>
                    navigation.navigate("Viewer", { albumId, index })
                }
            />

            <View
                className="absolute inset-x-0 top-0 flex-row items-center gap-1 bg-black/90 px-2"
                style={{ paddingTop: insets.top, height: topInset }}
            >
                <Pressable
                    onPress={() => navigation.goBack()}
                    hitSlop={8}
                    className="p-2 active:opacity-60"
                >
                    <Icon as={ChevronLeft} size={26} className="text-white" />
                </Pressable>
                <View className="flex-1">
                    <Text
                        numberOfLines={1}
                        className="text-lg font-semibold text-white"
                    >
                        {title}
                    </Text>
                    {isLoaded && (
                        <Text className="text-xs text-neutral-400">
                            {ids.length.toLocaleString()} photos
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}
