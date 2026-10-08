import { useState } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/ui/text";

type AdjustmentSliderProps = {
    /** Value between -1 and 1. */
    value: number;
    onChange: (value: number) => void;
    onCommit: (value: number) => void;
};

export function AdjustmentSlider({
    value,
    onChange,
    onCommit,
}: AdjustmentSliderProps) {
    const [trackWidth, setTrackWidth] = useState(1);
    const startingValue = useSharedValue(value);
    const latestValue = useSharedValue(value);
    const gesture = usePanGesture({
        minDistance: 0,
        onBegin: () => {
            "worklet";
            startingValue.value = value;
            latestValue.value = value;
        },
        onUpdate: (event) => {
            "worklet";
            latestValue.value = Math.min(
                Math.max(
                    startingValue.value + (event.translationX / trackWidth) * 2,
                    -1,
                ),
                1,
            );
            scheduleOnRN(onChange, latestValue.value);
        },
        onFinalize: () => {
            "worklet";
            scheduleOnRN(onCommit, latestValue.value);
        },
    });
    const position = ((value + 1) / 2) * trackWidth;

    return (
        <View className="items-center gap-2 px-8">
            <Text className="text-sm font-semibold tabular-nums text-amber-400">
                {value > 0 ? "+" : ""}
                {Math.round(value * 100)}
            </Text>
            <GestureDetector gesture={gesture}>
                <View
                    className="h-10 w-full justify-center"
                    onLayout={(event) =>
                        setTrackWidth(event.nativeEvent.layout.width)
                    }
                >
                    <View className="h-1 w-full rounded-full bg-white/20" />
                    <View
                        className="absolute h-1 rounded-full bg-amber-400"
                        style={{
                            left: Math.min(position, trackWidth / 2),
                            width: Math.abs(position - trackWidth / 2),
                        }}
                    />
                    <View
                        className="absolute h-3 w-0.5 bg-white/60"
                        style={{ left: trackWidth / 2 - 1 }}
                    />
                    <View
                        className="absolute h-6 w-6 rounded-full bg-white shadow-lg"
                        style={{ left: position - 12 }}
                    />
                </View>
            </GestureDetector>
        </View>
    );
}
