import type { LucideIcon } from "lucide-react-native";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TabButtonProps = {
    label: string;
    icon: LucideIcon;
    isActive: boolean;
    onPress: () => void;
};

export function TabButton({ label, icon, isActive, onPress }: TabButtonProps) {
    const colorClassName = isActive ? "text-white" : "text-neutral-500";

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            className="flex-1 items-center justify-center gap-1"
        >
            <Icon as={icon} size={22} className={colorClassName} />
            <Text className={cn("text-xs font-medium", colorClassName)}>
                {label}
            </Text>
        </Pressable>
    );
}
