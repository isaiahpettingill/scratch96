import { quantizeSpritePixels, type QuantizeFrameRect } from "./paletteQuantize.ts";

type QuantizeRequest = {
  id: number;
  image: { width: number; height: number; pixels: ArrayBuffer };
  frames: QuantizeFrameRect[];
};

self.addEventListener("message", (event: MessageEvent<QuantizeRequest>) => {
  const { id, image, frames } = event.data;
  try {
    const result = quantizeSpritePixels(
      { width: image.width, height: image.height, pixels: new Uint8ClampedArray(image.pixels) },
      frames,
    );
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : "Sprite palette quantization failed." });
  }
});
