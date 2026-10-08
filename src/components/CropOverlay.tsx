import { Fragment, useEffect } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { CropRect } from "@/lib/image-editing";

type CropOverlayProps = {
    /** Displayed image rectangle within the overlay, in points. */
    frame: { x: number; y: number; width: number; height: number };
    crop: CropRect;
    /** Locked crop aspect ratio in normalized units, or null when free. */
    aspect: number | null;
    onChange: (crop: CropRect) => void;
};

const HANDLE_REACH = 40;
const MINIMUM_SIZE = 0.1;
const MOVE = 4;

export function CropOverlay({
    frame,
    crop,
    aspect,
    onChange,
}: CropOverlayProps) {
    const rect = useSharedValue(crop);
    const start = useSharedValue(crop);
    const mode = useSharedValue(MOVE);

    useEffect(() => {
        rect.value = crop;
    }, [crop, rect]);

    const gesture = usePanGesture({
        minDistance: 0,
        maxPointers: 1,
        onBegin: (event) => {
            "worklet";
            const { x, y, width, height } = rect.value;
            const corners = [
                [x, y],
                [x + width, y],
                [x, y + height],
                [x + width, y + height],
            ].map(([cornerX, cornerY]) =>
                Math.hypot(
                    frame.x + cornerX * frame.width - event.x,
                    frame.y + cornerY * frame.height - event.y,
                ),
            );
            const nearest = corners.indexOf(Math.min(...corners));
            mode.value = corners[nearest] < HANDLE_REACH ? nearest : MOVE;
            start.value = rect.value;
        },
        onUpdate: (event) => {
            "worklet";
            const dx = event.translationX / frame.width;
            const dy = event.translationY / frame.height;
            const { x, y, width, height } = start.value;

            if (mode.value === MOVE) {
                rect.value = {
                    x: Math.min(Math.max(x + dx, 0), 1 - width),
                    y: Math.min(Math.max(y + dy, 0), 1 - height),
                    width,
                    height,
                };
                return;
            }

            const [right, bottom] = [mode.value % 2, mode.value >> 1];
            const anchorX = right ? x : x + width;
            const anchorY = bottom ? y : y + height;
            const reachX = right ? 1 - anchorX : anchorX;
            const reachY = bottom ? 1 - anchorY : anchorY;
            const pullX = right ? width + dx : width - dx;
            const pullY = bottom ? height + dy : height - dy;
            const newWidth = aspect
                ? Math.max(
                      Math.min(pullX, reachX, reachY / aspect),
                      MINIMUM_SIZE,
                  )
                : Math.min(Math.max(pullX, MINIMUM_SIZE), reachX);
            const newHeight = aspect
                ? newWidth * aspect
                : Math.min(Math.max(pullY, MINIMUM_SIZE), reachY);

            rect.value = {
                x: right ? anchorX : anchorX - newWidth,
                y: bottom ? anchorY : anchorY - newHeight,
                width: newWidth,
                height: newHeight,
            };
        },
        onFinalize: () => {
            "worklet";
            scheduleOnRN(onChange, rect.value);
        },
    });

    const cropStyle = useAnimatedStyle(() => ({
        left: frame.x + rect.value.x * frame.width,
        top: frame.y + rect.value.y * frame.height,
        width: rect.value.width * frame.width,
        height: rect.value.height * frame.height,
    }));

    return (
        <GestureDetector gesture={gesture}>
            <View className="absolute inset-0 overflow-hidden">
                <Animated.View
                    pointerEvents="none"
                    className="absolute border border-white/90"
                    style={[
                        cropStyle,
                        { boxShadow: "0 0 0 2000px rgba(0, 0, 0, 0.6)" },
                    ]}
                >
                    {["33.33%", "66.66%"].map((offset) => (
                        <Fragment key={offset}>
                            <View
                                className="absolute h-full w-px bg-white/30"
                                style={{ left: offset }}
                            />
                            <View
                                className="absolute h-px w-full bg-white/30"
                                style={{ top: offset }}
                            />
                        </Fragment>
                    ))}
                    {[
                        "left-[-3px] top-[-3px] border-l-[3px] border-t-[3px]",
                        "right-[-3px] top-[-3px] border-r-[3px] border-t-[3px]",
                        "bottom-[-3px] left-[-3px] border-b-[3px] border-l-[3px]",
                        "bottom-[-3px] right-[-3px] border-b-[3px] border-r-[3px]",
                    ].map((corner) => (
                        <View
                            key={corner}
                            className={`absolute h-5 w-5 border-white ${corner}`}
                        />
                    ))}
                </Animated.View>
            </View>
        </GestureDetector>
    );
}
