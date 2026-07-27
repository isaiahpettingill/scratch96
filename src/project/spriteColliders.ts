import type { SpriteAsset, SpriteCollider } from "./model.ts";

export function createDefaultSpriteColliders(sprite: Pick<SpriteAsset, "width" | "height">): SpriteCollider[] {
  return [createFullFrameCollider(sprite.width, sprite.height)];
}

export function normalizeSpriteColliders(sprite: SpriteAsset): SpriteAsset {
  if (sprite.colliders?.length > 0) return sprite;
  return { ...sprite, colliders: createDefaultSpriteColliders(sprite) };
}

function createFullFrameCollider(width: number, height: number): SpriteCollider {
  return {
    id: "body",
    name: "Body",
    shape: "rect",
    x: 0,
    y: 0,
    width,
    height,
  };
}
