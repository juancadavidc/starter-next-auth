import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makeImageVariants, VARIANT_WIDTHS } from "./image-variants";

async function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
}

describe("makeImageVariants", () => {
  it("produces sm/md/lg webp at the configured widths", async () => {
    const variants = await makeImageVariants(await png(1600, 800));
    expect(variants.map((v) => v.size)).toEqual(["sm", "md", "lg"]);
    for (const v of variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(VARIANT_WIDTHS[v.size]);
      expect(v.contentType).toBe("image/webp");
    }
  });

  it("never enlarges small images", async () => {
    const variants = await makeImageVariants(await png(300, 300));
    const widths = await Promise.all(variants.map(async (v) => (await sharp(v.buffer).metadata()).width));
    expect(widths).toEqual([200, 300, 300]);
  });

  it("rejects data that is not an image", async () => {
    await expect(makeImageVariants(Buffer.from("no soy una imagen"))).rejects.toThrow();
  });
});
