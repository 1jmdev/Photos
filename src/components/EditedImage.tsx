import {
    ColorMatrix,
    FilterMode,
    Group,
    Image,
    MipmapMode,
    type SkImage,
    Skia,
} from "react-native-skia";

import { colorMatrix, type ImageEdits, rotatedSize } from "@/lib/image-editing";

type EditedImageProps = {
    image: SkImage;
    edits: ImageEdits;
    width: number;
};

/** Draws the image with the edits applied, scaled to the given width. */
export function EditedImage({ image, edits, width }: EditedImageProps) {
    const { quarterTurns, flipped, crop } = edits;
    const source = { width: image.width(), height: image.height() };
    const rotated = rotatedSize(source, quarterTurns);
    const scale = width / (crop.width * rotated.width);
    const matrix = Skia.Matrix();

    matrix.scale(scale, scale);
    matrix.translate(-crop.x * rotated.width, -crop.y * rotated.height);
    if (flipped) {
        matrix.translate(rotated.width, 0);
        matrix.scale(-1, 1);
    }
    matrix.translate(rotated.width / 2, rotated.height / 2);
    matrix.rotate((-quarterTurns * Math.PI) / 2);
    matrix.translate(-source.width / 2, -source.height / 2);

    return (
        <Group matrix={matrix}>
            <Image
                image={image}
                x={0}
                y={0}
                width={source.width}
                height={source.height}
                sampling={{
                    filter: FilterMode.Linear,
                    mipmap: MipmapMode.Linear,
                }}
            >
                <ColorMatrix matrix={colorMatrix(edits)} />
            </Image>
        </Group>
    );
}

/** Pixel size of the edited image. */
export const editedSize = (
    image: SkImage,
    { quarterTurns, crop }: ImageEdits,
) => {
    const rotated = rotatedSize(
        { width: image.width(), height: image.height() },
        quarterTurns,
    );
    return {
        width: Math.round(crop.width * rotated.width),
        height: Math.round(crop.height * rotated.height),
    };
};
