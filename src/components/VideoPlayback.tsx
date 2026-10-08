import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import {
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Volume2,
    VolumeX,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatDuration } from "@/lib/format";

type VideoPlaybackProps = {
    uri: string;
    width: number;
    height: number;
    controlsVisible: boolean;
    onToggleControls: () => void;
};

export function VideoPlayback({
    uri,
    width,
    height,
    controlsVisible,
    onToggleControls,
}: VideoPlaybackProps) {
    const insets = useSafeAreaInsets();
    const player = useVideoPlayer(uri, (videoPlayer) => {
        videoPlayer.timeUpdateEventInterval = 0.1;
        videoPlayer.play();
    });
    const { isPlaying } = useEvent(player, "playingChange", {
        isPlaying: player.playing,
    });
    const { muted } = useEvent(player, "mutedChange", { muted: player.muted });
    const { status } = useEvent(player, "statusChange", {
        status: player.status,
    });
    const source = useEvent(player, "sourceLoad");
    const duration = source?.duration ?? player.duration;
    const [currentTime, setCurrentTime] = useState(0);
    const [trackWidth, setTrackWidth] = useState(1);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const resumeAfterScrubbing = useRef(false);

    useEffect(() => {
        const timeSubscription = player.addListener("timeUpdate", (event) => {
            if (!isScrubbing) {
                setCurrentTime(event.currentTime);
            }
        });
        const endSubscription = player.addListener("playToEnd", () =>
            setCurrentTime(player.duration),
        );
        const appSubscription = AppState.addEventListener("change", (state) => {
            if (state !== "active") {
                player.pause();
                resumeAfterScrubbing.current = false;
            }
        });

        return () => {
            timeSubscription.remove();
            endSubscription.remove();
            appSubscription.remove();
        };
    }, [player, isScrubbing]);

    function seek(position: number) {
        const nextTime = Math.min(duration, Math.max(0, position));

        player.currentTime = nextTime;
        setCurrentTime(nextTime);
    }

    const scrubGesture = usePanGesture({
        runOnJS: true,
        minDistance: 0,
        enabled: duration > 0 && status === "readyToPlay",
        onBegin: (event) => {
            resumeAfterScrubbing.current = player.playing;
            player.pause();
            setIsScrubbing(true);
            seek((event.x / trackWidth) * duration);
        },
        onUpdate: (event) => seek((event.x / trackWidth) * duration),
        onFinalize: () => {
            setIsScrubbing(false);
            if (resumeAfterScrubbing.current) {
                player.play();
            }
        },
    });

    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const hasEnded = duration > 0 && currentTime >= duration;

    return (
        <View style={{ width, height }}>
            <VideoView
                player={player}
                nativeControls={false}
                contentFit="contain"
                style={{ width, height }}
            />
            <Pressable
                onPress={onToggleControls}
                accessibilityRole="button"
                accessibilityLabel={
                    controlsVisible
                        ? "Hide video controls"
                        : "Show video controls"
                }
                className="absolute inset-0"
            />

            {(status === "loading" || status === "idle") && (
                <View
                    pointerEvents="none"
                    className="absolute inset-0 items-center justify-center"
                >
                    <ActivityIndicator size="large" color="white" />
                </View>
            )}
            {status === "error" && (
                <View
                    pointerEvents="none"
                    className="absolute inset-0 items-center justify-center gap-2 px-8"
                >
                    <Text className="text-lg font-semibold text-white">
                        Unable to play video
                    </Text>
                    <Text className="text-center text-sm text-neutral-300">
                        This file may no longer be available in your library.
                    </Text>
                </View>
            )}

            {controlsVisible && (
                <View
                    className="absolute inset-x-0 bottom-0 items-center px-5 pt-5"
                    style={{ paddingBottom: insets.bottom + 16 }}
                >
                    <View className="w-full max-w-xl rounded-3xl bg-black/60 px-4 pb-3 pt-3">
                        <View className="flex-row items-center gap-3">
                            <Text className="flex-1 text-xs font-medium tabular-nums text-white">
                                {formatDuration(currentTime * 1000)}
                            </Text>
                            <Text className="text-xs tabular-nums text-neutral-300">
                                −
                                {formatDuration(
                                    Math.max(0, duration - currentTime) * 1000,
                                )}
                            </Text>
                            <Pressable
                                onPress={() => {
                                    player.muted = !muted;
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    muted ? "Unmute video" : "Mute video"
                                }
                                className="h-11 w-11 items-center justify-center active:opacity-60"
                            >
                                <Icon
                                    as={muted ? VolumeX : Volume2}
                                    size={21}
                                    className="text-white"
                                />
                            </Pressable>
                        </View>
                        <GestureDetector gesture={scrubGesture}>
                            <View
                                accessible
                                accessibilityRole="adjustable"
                                accessibilityLabel="Video timeline"
                                accessibilityValue={{
                                    min: 0,
                                    max: duration,
                                    now: currentTime,
                                    text: `${formatDuration(currentTime * 1000)} of ${formatDuration(duration * 1000)}`,
                                }}
                                accessibilityActions={[
                                    {
                                        name: "increment",
                                        label: "Forward ten seconds",
                                    },
                                    {
                                        name: "decrement",
                                        label: "Back ten seconds",
                                    },
                                ]}
                                onAccessibilityAction={({ nativeEvent }) =>
                                    seek(
                                        currentTime +
                                            (nativeEvent.actionName ===
                                            "increment"
                                                ? 10
                                                : -10),
                                    )
                                }
                                onLayout={(event) =>
                                    setTrackWidth(
                                        event.nativeEvent.layout.width,
                                    )
                                }
                                className="h-11 justify-center"
                            >
                                <View className="h-1 overflow-hidden rounded-full bg-white/30">
                                    <View
                                        pointerEvents="none"
                                        className="h-full rounded-full bg-white"
                                        style={{
                                            width: `${progress * 100}%`,
                                        }}
                                    />
                                </View>
                                <View
                                    pointerEvents="none"
                                    className="absolute h-3 w-3 rounded-full bg-white"
                                    style={{
                                        left: progress * (trackWidth - 12),
                                    }}
                                />
                            </View>
                        </GestureDetector>
                        <View className="flex-row items-center justify-center gap-6">
                            <Pressable
                                onPress={() => seek(currentTime - 10)}
                                disabled={status !== "readyToPlay"}
                                accessibilityRole="button"
                                accessibilityLabel="Back ten seconds"
                                accessibilityState={{
                                    disabled: status !== "readyToPlay",
                                }}
                                className="h-12 w-12 items-center justify-center active:opacity-60"
                            >
                                <Icon
                                    as={RotateCcw}
                                    size={30}
                                    className="text-white"
                                />
                                <Text className="absolute pt-0.5 text-[10px] font-semibold text-white">
                                    10
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    if (isPlaying) {
                                        player.pause();
                                    } else {
                                        if (hasEnded) {
                                            seek(0);
                                        }
                                        player.play();
                                    }
                                }}
                                disabled={status !== "readyToPlay"}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    hasEnded
                                        ? "Replay video"
                                        : isPlaying
                                          ? "Pause video"
                                          : "Play video"
                                }
                                accessibilityState={{
                                    disabled: status !== "readyToPlay",
                                }}
                                className="h-12 w-12 items-center justify-center active:opacity-60"
                            >
                                <Icon
                                    as={
                                        hasEnded
                                            ? RotateCcw
                                            : isPlaying
                                              ? Pause
                                              : Play
                                    }
                                    size={32}
                                    fill={hasEnded ? "none" : "white"}
                                    className="text-white"
                                />
                            </Pressable>
                            <Pressable
                                onPress={() => seek(currentTime + 10)}
                                disabled={status !== "readyToPlay"}
                                accessibilityRole="button"
                                accessibilityLabel="Forward ten seconds"
                                accessibilityState={{
                                    disabled: status !== "readyToPlay",
                                }}
                                className="h-12 w-12 items-center justify-center active:opacity-60"
                            >
                                <Icon
                                    as={RotateCw}
                                    size={30}
                                    className="text-white"
                                />
                                <Text className="absolute pt-0.5 text-[10px] font-semibold text-white">
                                    10
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}
