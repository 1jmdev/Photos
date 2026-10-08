import { ChevronLeft, Info } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatFullDate, formatTime } from "@/lib/format";

type NavbarProps = {
    takenAt: number | null;
    isInfoVisible: boolean;
    onBack: () => void;
    onToggleInfo: () => void;
};

export function Navbar({
    takenAt,
    isInfoVisible,
    onBack,
    onToggleInfo,
}: NavbarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            pointerEvents="box-none"
            className="absolute inset-x-4 flex-row items-center gap-3"
            style={{ top: insets.top + 8 }}
        >
            <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back to library"
                className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 active:opacity-60"
            >
                <Icon as={ChevronLeft} size={26} className="text-white" />
            </Pressable>
            <View className="min-w-0 flex-1 items-center justify-center rounded-full border border-white/10 bg-black/60 px-3 py-2">
                <Text
                    numberOfLines={1}
                    className="text-sm font-semibold text-white"
                >
                    {takenAt === null ? "Photos" : formatFullDate(takenAt)}
                </Text>
                {takenAt !== null && (
                    <Text className="text-xs text-neutral-300">
                        {formatTime(takenAt)}
                    </Text>
                )}
            </View>
            <Pressable
                onPress={onToggleInfo}
                accessibilityRole="button"
                accessibilityLabel="Media information"
                accessibilityState={{ selected: isInfoVisible }}
                className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 active:opacity-60"
            >
                <Icon
                    as={Info}
                    size={22}
                    className={isInfoVisible ? "text-sky-400" : "text-white"}
                />
            </Pressable>
        </View>
    );
}
