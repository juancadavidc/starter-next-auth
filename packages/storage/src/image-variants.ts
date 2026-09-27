import sharp from "sharp";

export type VariantSize = "sm" | "md" | "lg";

export const VARIANT_WIDTHS: Record<VariantSize, number> = { sm: 200, md: 600, lg: 1200 };

export type ImageVariant = { size: VariantSize; buffer: Buffer; contentType: "image/webp" };

// Tres anchos en webp; nunca agranda una imagen pequeña. Lanza si el buffer no es imagen.
export async function makeImageVariants(input: Buffer): Promise<ImageVariant[]> {
  const sizes = Object.entries(VARIANT_WIDTHS) as [VariantSize, number][];
  return Promise.all(
    sizes.map(async ([size, width]) => ({
      size,
      buffer: await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      contentType: "image/webp" as const,
    })),
  );
}
