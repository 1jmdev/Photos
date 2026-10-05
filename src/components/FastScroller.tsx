import { ChevronsUpDown } from "lucide-react-native";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const IDLE_THUMB_WIDTH = 5;
const IDLE_THUMB_HEIGHT = 44;
const ACTIVE_THUMB_WIDTH = 30;
const ACTIVE_THUMB_HEIGHT = 56;
const EDGE_MARGIN = 3;
const HIDE_DELAY = 1500;

/** The content must be this many screens tall before the scroller appears. */
const MINIMUM_SCREEN_COUNT = 4;

export type FastScrollerHandle = {
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

type FastScrollerProps = {
    ref: Ref<FastScrollerHandle>;
    top: number;
    bottom: number;
    onScrollToOffset: (offset: number) => void;
    /** Returns the label shown next to the thumb while it is dragged. */
    resolveLabel: () => string | null;
};

/**
 * A thin scroll indicator on the right edge. It appears while the list
 * scrolls and grows when touched so it can be dragged to scroll quickly
 * through long lists, showing the current position label while dragging.
 */
export function FastScroller({
    ref,
    top,
    bottom,
    onScrollToOffset,
    resolveLabel,
}: FastScrollerProps) {
    const fraction = useSharedValue(0);
    const visibility = useSharedValue(0);
    const activity = useSharedValue(0);
    const trackHeight = useSharedValue(0);

    const metrics = useRef({ contentHeight: 0, viewportHeight: 0 });
    const dragStartFraction = useRef(0);
    const isDragging = useRef(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isEnabled, setIsEnabled] = useState(false);
    const [isInteractive, setIsInteractive] = useState(false);
    const [label, setLabel] = useState<string | null>(null);

    function cancelHide(): void {
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
        }
    }

    function scheduleHide(): void {
        cancelHide();
        hideTimer.current = setTimeout(() => {
            visibility.value = withTiming(0, { duration: 300 });
            setIsInteractive(false);
        }, HIDE_DELAY);
    }

    function reveal(): void {
        visibility.value = withTiming(1, { duration: 120 });
        setIsInteractive(true);
        cancelHide();
    }

    useImperativeHandle(ref, () => ({
        handleScroll(event) {
            const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent;
            const scrollableHeight =
                contentSize.height - layoutMeasurement.height;

            metrics.current = {
                contentHeight: contentSize.height,
                viewportHeight: layoutMeasurement.height,
            };
            setIsEnabled(
                contentSize.height >
                    layoutMeasurement.height * MINIMUM_SCREEN_COUNT,
            );

            if (isDragging.current) {
                return;
            }

            fraction.value =
                scrollableHeight > 0
                    ? Math.min(
                          1,
                          Math.max(0, contentOffset.y / scrollableHeight),
                      )
                    : 0;
            reveal();
            scheduleHide();
        },
    }));

    const panGesture = usePanGesture({
        runOnJS: true,
        minDistance: 0,
        hitSlop: { left: 24, right: 8, top: 12, bottom: 12 },
        onBegin: () => {
            isDragging.current = true;
            dragStartFraction.current = fraction.value;
            activity.value = withTiming(1, { duration: 150 });
            reveal();
            setLabel(resolveLabel());
        },
        onUpdate: (event) => {
            const travel = trackHeight.value - ACTIVE_THUMB_HEIGHT;

            if (travel <= 0) {
                return;
            }

            const nextFraction = Math.min(
                1,
                Math.max(
                    0,
                    dragStartFraction.current + event.translationY / travel,
                ),
            );
            const { contentHeight, viewportHeight } = metrics.current;

            fraction.value = nextFraction;
            onScrollToOffset(
                nextFraction * Math.max(0, contentHeight - viewportHeight),
            );
            setLabel(resolveLabel());
        },
        onFinalize: () => {
            isDragging.current = false;
            activity.value = withTiming(0, { duration: 200 });
            setLabel(null);
            scheduleHide();
        },
    });

    const containerStyle = useAnimatedStyle(() => {
        const thumbHeight =
            IDLE_THUMB_HEIGHT +
            (ACTIVE_THUMB_HEIGHT - IDLE_THUMB_HEIGHT) * activity.value;
        const travel = Math.max(0, trackHeight.value - thumbHeight);

        return {
            opacity: visibility.value,
            transform: [{ translateY: fraction.value * travel }],
        };
    });

    const thumbStyle = useAnimatedStyle(() => {
        const width =
            IDLE_THUMB_WIDTH +
            (ACTIVE_THUMB_WIDTH - IDLE_THUMB_WIDTH) * activity.value;

        return {
            width,
            height:
                IDLE_THUMB_HEIGHT +
                (ACTIVE_THUMB_HEIGHT - IDLE_THUMB_HEIGHT) * activity.value,
            borderRadius: width / 2,
        };
    });

    const iconStyle = useAnimatedStyle(() => ({
        opacity: activity.value,
    }));

    if (!isEnabled) {
        return null;
    }

    return (
        <View
            pointerEvents="box-none"
            className="absolute right-0 w-56"
            style={{ top, bottom }}
            onLayout={(event) => {
                trackHeight.value = event.nativeEvent.layout.height;
            }}
        >
            <Animated.View
                pointerEvents="box-none"
                className="absolute right-0 top-0 flex-row items-center gap-2"
                style={[{ marginRight: EDGE_MARGIN }, containerStyle]}
            >
                {label && (
                    <View className="rounded-full bg-neutral-100 px-3 py-1.5">
                        <Text className="text-sm font-semibold text-black">
                            {label}
                        </Text>
                    </View>
                )}
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        pointerEvents={isInteractive ? "auto" : "none"}
                        className="items-center justify-center bg-neutral-300"
                        style={thumbStyle}
                    >
                        <Animated.View style={iconStyle}>
                            <Icon
                                as={ChevronsUpDown}
                                size={16}
                                className="text-black"
                            />
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </Animated.View>
        </View>
    );
}
