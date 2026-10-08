export type CropRect = { x: number; y: number; width: number; height: number };

export type Adjustment = "brightness" | "contrast" | "saturation" | "warmth";

export type ImageEdits = {
    /** Counter-clockwise quarter turns applied to the source image. */
    quarterTurns: number;
    flipped: boolean;
    /** Normalized crop in the rotated image space. */
    crop: CropRect;
    adjustments: Record<Adjustment, number>;
    filter: string;
};

export const ORIGINAL_EDITS: ImageEdits = {
    quarterTurns: 0,
    flipped: false,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    adjustments: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    filter: "Original",
};

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const scaleOffset = (r: number, g: number, b: number, offset = 0) => [
    r,
    0,
    0,
    0,
    offset,
    0,
    g,
    0,
    0,
    offset,
    0,
    0,
    b,
    0,
    offset,
    0,
    0,
    0,
    1,
    0,
];

const brightness = (value: number) => scaleOffset(1, 1, 1, value * 0.25);

const contrast = (scale: number) =>
    scaleOffset(scale, scale, scale, (1 - scale) / 2);

const warmth = (value: number) =>
    scaleOffset(1 + value * 0.12, 1 + value * 0.03, 1 - value * 0.12);

const saturation = (scale: number) => {
    const [r, g, b] = [0.2126, 0.7152, 0.0722].map(
        (weight) => weight * (1 - scale),
    );
    return [
        r + scale,
        g,
        b,
        0,
        0,
        r,
        g + scale,
        b,
        0,
        0,
        r,
        g,
        b + scale,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
    ];
};

/** Composes 4×5 color matrices; the last one is applied first. */
const compose = (...matrices: number[][]) =>
    matrices.reduce((outer, inner) =>
        outer.map((_, index) => {
            const [row, column] = [Math.floor(index / 5), index % 5];
            return (
                [0, 1, 2, 3].reduce(
                    (sum, k) =>
                        sum + outer[row * 5 + k] * inner[k * 5 + column],
                    0,
                ) + (column === 4 ? outer[row * 5 + 4] : 0)
            );
        }),
    );

export const FILTERS: Record<string, number[]> = {
    Original: IDENTITY,
    Vivid: compose(saturation(1.4), contrast(1.1)),
    Warm: compose(warmth(0.7), saturation(1.1)),
    Cool: compose(warmth(-0.7), contrast(1.05)),
    Fade: compose(brightness(0.2), contrast(0.8), saturation(0.75)),
    Dramatic: compose(contrast(1.35), saturation(0.85), brightness(-0.15)),
    Mono: saturation(0),
    Noir: compose(contrast(1.45), saturation(0)),
    Sepia: [
        0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534,
        0.131, 0, 0, 0, 0, 0, 1, 0,
    ],
};

export const colorMatrix = ({ adjustments, filter }: ImageEdits) =>
    compose(
        warmth(adjustments.warmth),
        saturation(1 + adjustments.saturation),
        contrast(1 + adjustments.contrast * 0.6),
        brightness(adjustments.brightness),
        FILTERS[filter],
    );

export const rotatedSize = (
    { width, height }: { width: number; height: number },
    quarterTurns: number,
) => (quarterTurns % 2 ? { width: height, height: width } : { width, height });

/** Rotates the edits a quarter turn counter-clockwise as seen on screen. */
export const rotateEdits = (edits: ImageEdits): ImageEdits => ({
    ...edits,
    quarterTurns: (edits.quarterTurns + (edits.flipped ? 3 : 1)) % 4,
    crop: {
        x: edits.crop.y,
        y: 1 - edits.crop.x - edits.crop.width,
        width: edits.crop.height,
        height: edits.crop.width,
    },
});

export const flipEdits = (edits: ImageEdits): ImageEdits => ({
    ...edits,
    flipped: !edits.flipped,
    crop: { ...edits.crop, x: 1 - edits.crop.x - edits.crop.width },
});

/** Largest centered crop with the given pixel aspect ratio. */
export const centeredCrop = (
    size: { width: number; height: number },
    aspect: number,
): CropRect => {
    const ratio = size.width / (size.height * aspect);
    const [width, height] = ratio > 1 ? [1 / ratio, 1] : [1, ratio];
    return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
};
