import { risc96Buttons } from "../../project/controls.ts";
import type { Risc96Project } from "../../project/model.ts";

let spriteOptions: [string, string][] = [["Player", "player"]];
let animationOptions: [string, string][] = [["No animations yet", ""]];
let fontOptions: [string, string][] = [["MSX International 8x8", "msx_international_8x8"]];
let tilemapOptions: [string, string][] = [["No tilemaps yet", ""]];
let soundOptions: [string, string][] = [["No sounds yet", ""]];

export function refreshProjectBlockOptions(project?: Risc96Project): void {
  spriteOptions = createSpriteOptions(project);
  animationOptions = createAnimationOptions(project);
  fontOptions = createFontOptions(project);
  tilemapOptions = createTilemapOptions(project);
  soundOptions = createSoundOptions(project);
}

export function getSpriteOptions(): [string, string][] {
  return spriteOptions;
}

export function getAnimationOptions(): [string, string][] {
  return animationOptions;
}

export function getFontOptions(): [string, string][] {
  return fontOptions;
}

export function getTilemapOptions(): [string, string][] {
  return tilemapOptions;
}

export function getSoundOptions(): [string, string][] {
  return soundOptions;
}

export function mathOperatorOptions(): [string, string][] {
  return ["+", "-", "*", "/", "%", "<<", ">>", "&", "|", "^"].map((operator) => [
    operator,
    operator,
  ]);
}

export function compareOperatorOptions(): [string, string][] {
  return ["==", "!=", "<", "<=", ">", ">="].map((operator) => [operator, operator]);
}

export function mathUnaryOptions(): [string, string][] {
  return ["abs", "sqrt"].map((operator) => [operator, operator]);
}

export function booleanOperatorOptions(): [string, string][] {
  return [
    ["and", "and"],
    ["or", "or"],
  ];
}

export function minMaxOptions(): [string, string][] {
  return [
    ["min", "min"],
    ["max", "max"],
  ];
}

export function trigOptions(): [string, string][] {
  return [
    ["sin", "sin"],
    ["cos", "cos"],
  ];
}

export function buttonStateOptions(): [string, string][] {
  return [
    ["down", "down"],
    ["pressed", "pressed"],
    ["released", "released"],
  ];
}

export function axisOptions(): [string, string][] {
  return [
    ["x", "x"],
    ["y", "y"],
  ];
}

export function playerOptions(): [string, string][] {
  return [
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
  ];
}

export function buttonOptions(): [string, string][] {
  return risc96Buttons.map((button) => [button, button]);
}

export function fillOptions(): [string, string][] {
  return [
    ["filled", "filled"],
    ["outline", "outline"],
  ];
}

function createSpriteOptions(project?: Risc96Project): [string, string][] {
  const options = project?.sprites.map((sprite) => [sprite.name, sprite.id] as [string, string]) ?? [];
  return options.length > 0 ? options : [["No sprites yet", ""]];
}

function createAnimationOptions(project?: Risc96Project): [string, string][] {
  const options =
    project?.sprites.flatMap((sprite) =>
      (sprite.animations ?? []).map(
        (animation) => [`${sprite.name}: ${animation.name}`, `${sprite.id}:${animation.id}`] as [string, string],
      ),
    ) ?? [];

  return options.length > 0 ? options : [["No animations yet", ""]];
}

function createFontOptions(project?: Risc96Project): [string, string][] {
  const options = project?.fonts.map((font) => [font.name, font.id] as [string, string]) ?? [];
  return options.length > 0 ? options : [["MSX International 8x8", "msx_international_8x8"]];
}

function createTilemapOptions(project?: Risc96Project): [string, string][] {
  const options = project?.tilemaps.map((tilemap) => [tilemap.name, tilemap.id] as [string, string]) ?? [];
  return options.length > 0 ? options : [["No tilemaps yet", ""]];
}

function createSoundOptions(project?: Risc96Project): [string, string][] {
  const options = project?.sounds.map((sound) => [sound.name, sound.id] as [string, string]) ?? [];
  return options.length > 0 ? options : [["No sounds yet", ""]];
}
