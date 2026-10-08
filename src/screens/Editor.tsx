import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { File, Paths } from "expo-file-system";
import { Asset } from "expo-media-library";
import {
    Contrast,
    Crop,
    Droplet,
    FlipHorizontal2,
    Redo2,
    RotateCcw,
    SlidersHorizontal,
    Sparkles,
    Sun,
    Thermometer,
    Undo2,
    X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Canvas, drawAsImage, ImageFormat, useImage } from "react-native-skia";

import { AdjustmentSlider } from "@/components/AdjustmentSlider";
import { CropOverlay } from "@/components/CropOverlay";
import { EditedImage, editedSize } from "@/components/EditedImage";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
    type Adjustment,
    centeredCrop,
    FILTERS,
    flipEdits,
    type ImageEdits,
    ORIGINAL_EDITS,
    rotatedSize,
    rotateEdits,
} from "@/lib/image-editing";
import { syncMediaLibraryChange } from "@/lib/media-sync";
import { cn } from "@/lib/utils";
import type { RootStackParamList } from "@/navigation";

type Tool = "crop" | "adjust" | "filters";

const TOOLS = [
    { key: "crop", label: "Crop", icon: Crop },
    { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
    { key: "filters", label: "Filters", icon: Sparkles },
] as const;

const ADJUSTMENTS = [
    { key: "brightness", label: "Brightness", icon: Sun },
    { key: "contrast", label: "Contrast", icon: Contrast },
    { key: "saturation", label: "Saturation", icon: Droplet },
    { key: "warmth", label: "Warmth", icon: Thermometer },
] as const;

const ASPECTS = [
    { label: "Free", ratio: null },
    { label: "Square", ratio: 1 },
    { label: "4:3", ratio: 4 / 3 },
    { label: "3:4", ratio: 3 / 4 },
    { label: "16:9", ratio: 16 / 9 },
    { label: "9:16", ratio: 9 / 16 },
];

const THUMBNAIL_SIZE = 68;

const fit = (
    size: { width: number; height: number },
    area: { width: number; height: number },
) => {
    const scale = Math.min(area.width / size.width, area.height / size.height);
    return { width: size.width * scale, height: size.height * scale };
};

export function EditorScreen({
    navigation,
    route,
}: NativeStackScreenProps<RootStackParamList, "Editor">) {
    const insets = useSafeAreaInsets();
    const [uri, setUri] = useState<string | null>(null);
    const image = useImage(uri);
    const [history, setHistory] = useState({
        entries: [ORIGINAL_EDITS],
        index: 0,
    });
    const [draft, setDraft] = useState<ImageEdits | null>(null);
    const [tool, setTool] = useState<Tool>("adjust");
    const [adjustment, setAdjustment] = useState<Adjustment>("brightness");
    const [aspect, setAspect] = useState<number | null>(null);
    const [area, setArea] = useState({ width: 0, height: 0 });
    const [isComparing, setIsComparing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        new Asset(route.params.id).getUri().then(setUri);
    }, [route.params.id]);

    const edits = history.entries[history.index];
    const isOriginal = JSON.stringify(edits) === JSON.stringify(ORIGINAL_EDITS);

    const commit = (next: ImageEdits) => {
        setDraft(null);
        if (JSON.stringify(next) !== JSON.stringify(edits)) {
            setHistory({
                entries: [...history.entries.slice(0, history.index + 1), next],
                index: history.index + 1,
            });
        }
    };

    const save = async () => {
        if (!image) {
            return;
        }
        setIsSaving(true);
        const size = editedSize(image, edits);
        const output = await drawAsImage(
            <EditedImage image={image} edits={edits} width={size.width} />,
            size,
        );
        const file = new File(Paths.cache, `edited-${Date.now()}.jpg`);
        file.write(output?.encodeToBytes(ImageFormat.JPEG, 95));
        const asset = await Asset.create(file.uri);
        file.delete();
        syncMediaLibraryChange({
            hasIncrementalChanges: true,
            insertedAssets: [asset.id],
            deletedAssets: [],
        });
        navigation.popTo("Viewer", {
            source: { kind: "all" },
            index: 0,
            focusId: asset.id,
        });
    };

    if (!image) {
        return (
            <View className="flex-1 items-center justify-center bg-black">
                <ActivityIndicator color="white" />
            </View>
        );
    }

    const current = draft ?? edits;
    const isCropping = tool === "crop";
    const shown = {
        ...current,
        crop: isCropping ? ORIGINAL_EDITS.crop : current.crop,
        ...(isComparing && {
            adjustments: ORIGINAL_EDITS.adjustments,
            filter: ORIGINAL_EDITS.filter,
        }),
    };
    const rotated = rotatedSize(
        { width: image.width(), height: image.height() },
        current.quarterTurns,
    );
    const output = editedSize(image, current);
    const preview = fit(editedSize(image, shown), area);

    return (
        <View
            className="flex-1 bg-black"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            <StatusBar barStyle="light-content" />

            <View className="h-14 flex-row items-center gap-2 px-3">
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing"
                    className="h-11 w-11 items-center justify-center rounded-full bg-white/10 active:opacity-60"
                >
                    <Icon as={X} size={22} className="text-white" />
                </Pressable>
                <View className="flex-1 flex-row items-center justify-center gap-1">
                    {[
                        {
                            icon: Undo2,
                            label: "Undo",
                            disabled: history.index === 0,
                            index: history.index - 1,
                        },
                        {
                            icon: Redo2,
                            label: "Redo",
                            disabled:
                                history.index === history.entries.length - 1,
                            index: history.index + 1,
                        },
                    ].map((action) => (
                        <Pressable
                            key={action.label}
                            onPress={() =>
                                setHistory({ ...history, index: action.index })
                            }
                            disabled={action.disabled}
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                            className={cn(
                                "h-11 w-11 items-center justify-center rounded-full active:opacity-60",
                                action.disabled && "opacity-30",
                            )}
                        >
                            <Icon
                                as={action.icon}
                                size={22}
                                className="text-white"
                            />
                        </Pressable>
                    ))}
                    {!isOriginal && (
                        <Pressable
                            onPress={() => commit(ORIGINAL_EDITS)}
                            accessibilityRole="button"
                            className="h-9 justify-center rounded-full px-3 active:opacity-60"
                        >
                            <Text className="text-sm font-semibold text-white">
                                Revert
                            </Text>
                        </Pressable>
                    )}
                </View>
                <Pressable
                    onPress={save}
                    disabled={isOriginal || isSaving}
                    accessibilityRole="button"
                    className={cn(
                        "h-10 min-w-20 items-center justify-center rounded-full bg-amber-400 px-5 active:opacity-70",
                        isOriginal && "opacity-40",
                    )}
                >
                    {isSaving ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text className="text-sm font-bold text-black">
                            Save
                        </Text>
                    )}
                </Pressable>
            </View>

            <View
                className="flex-1 items-center justify-center"
                style={{ margin: 20 }}
                onLayout={(event) =>
                    setArea({
                        width: event.nativeEvent.layout.width,
                        height: event.nativeEvent.layout.height,
                    })
                }
            >
                <Pressable
                    disabled={isCropping}
                    onPressIn={() => setIsComparing(true)}
                    onPressOut={() => setIsComparing(false)}
                    accessibilityLabel="Hold to compare with the original"
                >
                    <Canvas style={preview}>
                        <EditedImage
                            image={image}
                            edits={shown}
                            width={preview.width}
                        />
                    </Canvas>
                </Pressable>
                {isCropping && (
                    <CropOverlay
                        frame={{
                            x: (area.width - preview.width) / 2,
                            y: (area.height - preview.height) / 2,
                            ...preview,
                        }}
                        crop={current.crop}
                        aspect={
                            aspect && rotated.width / (rotated.height * aspect)
                        }
                        onChange={(crop) => commit({ ...edits, crop })}
                    />
                )}
                {isComparing && (
                    <View className="absolute top-3 rounded-full bg-black/70 px-3 py-1">
                        <Text className="text-xs font-semibold text-white">
                            Original
                        </Text>
                    </View>
                )}
            </View>

            <View className="h-36 justify-center">
                {tool === "crop" && (
                    <View className="gap-4">
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerClassName="gap-2 px-4"
                        >
                            {ASPECTS.map((option) => (
                                <Pressable
                                    key={option.label}
                                    onPress={() => {
                                        setAspect(option.ratio);
                                        if (option.ratio) {
                                            commit({
                                                ...edits,
                                                crop: centeredCrop(
                                                    rotated,
                                                    option.ratio,
                                                ),
                                            });
                                        }
                                    }}
                                    accessibilityRole="button"
                                    className={cn(
                                        "h-9 justify-center rounded-full border px-4 active:opacity-60",
                                        aspect === option.ratio
                                            ? "border-amber-400 bg-amber-400/15"
                                            : "border-white/15 bg-white/5",
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            "text-sm font-medium",
                                            aspect === option.ratio
                                                ? "text-amber-400"
                                                : "text-white",
                                        )}
                                    >
                                        {option.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <View className="flex-row items-center justify-center gap-6">
                            {[
                                {
                                    icon: RotateCcw,
                                    label: "Rotate",
                                    onPress: () => {
                                        setAspect(
                                            (ratio) => ratio && 1 / ratio,
                                        );
                                        commit(rotateEdits(edits));
                                    },
                                },
                                {
                                    icon: FlipHorizontal2,
                                    label: "Flip",
                                    onPress: () => commit(flipEdits(edits)),
                                },
                            ].map((action) => (
                                <Pressable
                                    key={action.label}
                                    onPress={action.onPress}
                                    accessibilityRole="button"
                                    className="flex-row items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 active:opacity-60"
                                >
                                    <Icon
                                        as={action.icon}
                                        size={18}
                                        className="text-white"
                                    />
                                    <Text className="text-sm font-medium text-white">
                                        {action.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {tool === "adjust" && (
                    <View className="gap-3">
                        <AdjustmentSlider
                            key={adjustment}
                            value={current.adjustments[adjustment]}
                            onChange={(value) =>
                                setDraft({
                                    ...edits,
                                    adjustments: {
                                        ...edits.adjustments,
                                        [adjustment]: value,
                                    },
                                })
                            }
                            onCommit={(value) =>
                                commit({
                                    ...edits,
                                    adjustments: {
                                        ...edits.adjustments,
                                        [adjustment]: value,
                                    },
                                })
                            }
                        />
                        <View className="flex-row justify-center gap-5">
                            {ADJUSTMENTS.map((option) => (
                                <Pressable
                                    key={option.key}
                                    onPress={() => setAdjustment(option.key)}
                                    accessibilityRole="button"
                                    accessibilityLabel={option.label}
                                    accessibilityState={{
                                        selected: adjustment === option.key,
                                    }}
                                    className={cn(
                                        "h-12 w-12 items-center justify-center rounded-full border active:opacity-60",
                                        adjustment === option.key
                                            ? "border-amber-400 bg-amber-400/15"
                                            : "border-white/15 bg-white/5",
                                    )}
                                >
                                    <Icon
                                        as={option.icon}
                                        size={20}
                                        className={
                                            adjustment === option.key
                                                ? "text-amber-400"
                                                : "text-white"
                                        }
                                    />
                                    {current.adjustments[option.key] !== 0 && (
                                        <View className="absolute -bottom-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {tool === "filters" && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerClassName="gap-3 px-4"
                    >
                        {Object.keys(FILTERS).map((filter) => {
                            const thumbnail =
                                (THUMBNAIL_SIZE *
                                    Math.max(output.width, output.height)) /
                                Math.min(output.width, output.height);
                            const canvas =
                                output.width > output.height
                                    ? {
                                          width: thumbnail,
                                          height: THUMBNAIL_SIZE,
                                      }
                                    : {
                                          width: THUMBNAIL_SIZE,
                                          height: thumbnail,
                                      };
                            return (
                                <Pressable
                                    key={filter}
                                    onPress={() => commit({ ...edits, filter })}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: current.filter === filter,
                                    }}
                                    className="items-center gap-1.5 active:opacity-70"
                                >
                                    <View
                                        className={cn(
                                            "items-center justify-center overflow-hidden rounded-xl border-2",
                                            current.filter === filter
                                                ? "border-amber-400"
                                                : "border-transparent",
                                        )}
                                        style={{
                                            width: THUMBNAIL_SIZE,
                                            height: THUMBNAIL_SIZE,
                                        }}
                                    >
                                        <Canvas style={canvas}>
                                            <EditedImage
                                                image={image}
                                                edits={{ ...current, filter }}
                                                width={canvas.width}
                                            />
                                        </Canvas>
                                    </View>
                                    <Text
                                        className={cn(
                                            "text-xs font-medium",
                                            current.filter === filter
                                                ? "text-amber-400"
                                                : "text-neutral-400",
                                        )}
                                    >
                                        {filter}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            <View className="flex-row justify-around border-t border-white/10 pt-2">
                {TOOLS.map((option) => (
                    <Pressable
                        key={option.key}
                        onPress={() => setTool(option.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tool === option.key }}
                        className="items-center gap-1 px-6 py-1.5 active:opacity-60"
                    >
                        <Icon
                            as={option.icon}
                            size={22}
                            className={
                                tool === option.key
                                    ? "text-amber-400"
                                    : "text-neutral-400"
                            }
                        />
                        <Text
                            className={cn(
                                "text-xs font-semibold",
                                tool === option.key
                                    ? "text-amber-400"
                                    : "text-neutral-400",
                            )}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
