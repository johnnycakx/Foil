// Rasterize the current brand icon (petal on charcoal, public/icon.svg) into
// the PNG sizes the manifest + apple-touch need (brand-og-unification).
import sharp from "sharp";

const src = "public/icon.svg";
for (const [out, px] of [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
]) {
  await sharp(src, { density: 300 }).resize(px, px).png().toFile(out);
  console.log(`OK ${out} (${px}px)`);
}
