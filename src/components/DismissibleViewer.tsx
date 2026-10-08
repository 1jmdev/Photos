import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

type DismissibleViewerProps = {
    children: ReactNode;
    onDismiss: () => void;
};

export function DismissibleViewer({
    children,
    onDismiss,
}: DismissibleViewerProps) {
    const { height } = useWindowDimensions();
    const offset = useSharedValue(0);
    const startingOffset = useSharedValue(0);
    const gesture = usePanGesture({
        activeOffsetY: 12,
        failOffsetY: -8,
        failOffsetX: [-16, 16],
        maxPointers: 1,
        onActivate: () => {
            "worklet";
            cancelAnimation(offset);
            startingOffset.value = offset.value;
        },
        onUpdate: (event) => {
            "worklet";
            offset.value = Math.max(
                0,
                startingOffset.value + event.translationY,
            );
        },
        onFinalize: (event) => {
            "worklet";
            if (!event.canceled && offset.value > height * 0.2) {
                offset.value = withTiming(
                    height,
                    { duration: 240 },
                    (finished) => {
                        if (finished) {
                            scheduleOnRN(onDismiss);
                        }
                    },
                );
            } else {
                offset.value = withSpring(0, {
                    damping: 24,
                    stiffness: 220,
                    overshootClamping: true,
                });
            }
        },
    });
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(1, offset.value / height),
    }));
    const contentStyle = useAnimatedStyle(() => ({
        borderRadius: Math.min(24, offset.value / 4),
        transform: [
            { translateY: offset.value },
            { scale: 1 - Math.min(1, offset.value / height) * 0.08 },
        ],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <View className="flex-1">
                <Animated.View
                    pointerEvents="none"
                    className="absolute inset-0 bg-black"
                    style={backdropStyle}
                />
                <Animated.View
                    className="flex-1 overflow-hidden bg-black"
                    style={contentStyle}
                >
                    {children}
                </Animated.View>
            </View>
        </GestureDetector>
    );
}
