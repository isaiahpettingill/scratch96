import { quantizeSpritePixels, type QuantizedSpritePixels, type QuantizeFrameRect } from "./paletteQuantize.ts";
import type { DecodedSpritesheetImage } from "./spritesheetImport.ts";

type WorkerResponse =
  | { id: number; ok: true; result: QuantizedSpritePixels }
  | { id: number; ok: false; error: string };

let worker: Worker | undefined;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (value: QuantizedSpritePixels) => void; reject: (error: Error) => void }>();

export async function quantizeSpritePixelsInBackground(
  decoded: DecodedSpritesheetImage,
  frames: QuantizeFrameRect[],
): Promise<QuantizedSpritePixels> {
  if (typeof Worker === "undefined") return quantizeSpritePixels(decoded, frames);

  const requestId = nextRequestId;
  nextRequestId += 1;
  const pixels = transferablePixels(decoded.pixels);

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    try {
      paletteWorker().postMessage(
        { id: requestId, image: { width: decoded.width, height: decoded.height, pixels: pixels.buffer }, frames },
        [pixels.buffer],
      );
    } catch (error) {
      pending.delete(requestId);
      reject(error instanceof Error ? error : new Error("Sprite palette worker failed."));
    }
  });
}

function transferablePixels(pixels: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  if (pixels.buffer instanceof ArrayBuffer && pixels.byteOffset === 0 && pixels.byteLength === pixels.buffer.byteLength) {
    return pixels as Uint8ClampedArray<ArrayBuffer>;
  }
  return Uint8ClampedArray.from(pixels);
}

function paletteWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./paletteQuantizeWorker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.ok) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error));
  });
  worker.addEventListener("error", (event) => {
    const error = new Error(event.message || "Sprite palette worker failed.");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker?.terminate();
    worker = undefined;
  });
  return worker;
}
