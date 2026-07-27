use aseprite::{AsepriteFile, CelKind, ColorMode, LayerKind, LoopDirection, Pixels};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedSprite {
    width: u16,
    height: u16,
    frames: Vec<ParsedFrame>,
    animations: Vec<ParsedAnimation>,
}

#[derive(Serialize)]
struct ParsedFrame {
    rgba: Vec<u8>,
}

#[derive(Serialize)]
struct ParsedAnimation {
    name: String,
    from: usize,
    to: usize,
    direction: &'static str,
    repeat: u16,
}

#[wasm_bindgen]
pub fn parse_aseprite(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let file = AsepriteFile::from_reader(bytes).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let parsed = ParsedSprite {
        width: file.width(),
        height: file.height(),
        frames: composite_frames(&file),
        animations: file
            .tags()
            .iter()
            .map(|tag| ParsedAnimation {
                name: tag.name.clone(),
                from: tag.from_frame,
                to: tag.to_frame,
                direction: match tag.direction {
                    LoopDirection::Forward => "forward",
                    LoopDirection::Reverse => "reverse",
                    LoopDirection::PingPong | LoopDirection::PingPongReverse => "pingpong",
                    _ => "forward",
                },
                repeat: tag.repeat,
            })
            .collect(),
    };

    serde_wasm_bindgen::to_value(&parsed).map_err(|error| JsValue::from_str(&error.to_string()))
}

fn composite_frames(file: &AsepriteFile) -> Vec<ParsedFrame> {
    (0..file.frames().len())
        .map(|frame_index| {
            let mut rgba = vec![0; file.width() as usize * file.height() as usize * 4];
            let mut cels = file
                .layers()
                .iter()
                .enumerate()
                .filter_map(|(layer_index, layer)| {
                    if !layer.visible || layer.reference_layer || matches!(layer.kind, LayerKind::Group) {
                        return None;
                    }
                    let layer_ref = file.layer_ref(layer_index)?;
                    let cel = file.cel(layer_ref, frame_index)?;
                    let resolved = file.resolve_cel(layer_ref, frame_index)?;
                    Some((layer_index, layer.opacity, cel, resolved))
                })
                .collect::<Vec<_>>();

            cels.sort_by(|left, right| cel_order(left.0, left.2.z_index).cmp(&cel_order(right.0, right.2.z_index)));

            for (_, layer_opacity, cel, resolved) in cels {
                if let Some((pixels, x, y)) = cel_pixels(cel, resolved) {
                    blit_pixels(&mut rgba, file, pixels, x, y, combined_opacity(layer_opacity, cel.opacity));
                }
            }

            ParsedFrame { rgba }
        })
        .collect()
}

fn cel_order(layer_index: usize, z_index: i16) -> (isize, i16) {
    (layer_index as isize + z_index as isize, z_index)
}

fn cel_pixels<'a>(cel: &'a aseprite::Cel, resolved: &'a aseprite::Cel) -> Option<(&'a Pixels, i16, i16)> {
    let (x, y) = match &cel.kind {
        CelKind::Raw { x, y, .. }
        | CelKind::Compressed { x, y, .. }
        | CelKind::Linked { x, y, .. }
        | CelKind::Tilemap { x, y, .. } => (*x, *y),
        _ => (0, 0),
    };

    match &resolved.kind {
        CelKind::Raw { pixels, .. } | CelKind::Compressed { pixels, .. } => Some((pixels, x, y)),
        _ => None,
    }
}

fn combined_opacity(layer_opacity: u8, cel_opacity: u8) -> u8 {
    ((layer_opacity as u16 * cel_opacity as u16 + 127) / 255) as u8
}

fn blit_pixels(target: &mut [u8], file: &AsepriteFile, pixels: &Pixels, offset_x: i16, offset_y: i16, opacity: u8) {
    for y in 0..pixels.height {
        for x in 0..pixels.width {
            let dest_x = offset_x + x as i16;
            let dest_y = offset_y + y as i16;
            if dest_x < 0 || dest_y < 0 || dest_x >= file.width() as i16 || dest_y >= file.height() as i16 {
                continue;
            }

            let source_pixel = y as usize * pixels.width as usize + x as usize;
            let rgba = pixel_rgba(file, pixels, source_pixel, opacity);
            blend_pixel(target, (dest_y as usize * file.width() as usize + dest_x as usize) * 4, rgba);
        }
    }
}

fn pixel_rgba(file: &AsepriteFile, pixels: &Pixels, pixel: usize, opacity: u8) -> [u8; 4] {
    let mut rgba = match file.color_mode() {
        ColorMode::Rgba => {
            let index = pixel * 4;
            [
                *pixels.data.get(index).unwrap_or(&0),
                *pixels.data.get(index + 1).unwrap_or(&0),
                *pixels.data.get(index + 2).unwrap_or(&0),
                *pixels.data.get(index + 3).unwrap_or(&0),
            ]
        }
        ColorMode::Grayscale => {
            let index = pixel * 2;
            let value = *pixels.data.get(index).unwrap_or(&0);
            [value, value, value, *pixels.data.get(index + 1).unwrap_or(&0)]
        }
        ColorMode::Indexed => {
            let palette_index = *pixels.data.get(pixel).unwrap_or(&0);
            if palette_index == file.transparent_index() {
                [0, 0, 0, 0]
            } else if let Some(color) = file.palette().get(palette_index as usize) {
                [color.r, color.g, color.b, color.a]
            } else {
                [0, 0, 0, 0]
            }
        }
        _ => [0, 0, 0, 0],
    };
    rgba[3] = ((rgba[3] as u16 * opacity as u16 + 127) / 255) as u8;
    rgba
}

fn blend_pixel(target: &mut [u8], dest: usize, source: [u8; 4]) {
    let source_alpha = source[3] as f32 / 255.0;
    if source_alpha <= 0.0 {
        return;
    }
    if source_alpha >= 1.0 || target[dest + 3] == 0 {
        target[dest..dest + 4].copy_from_slice(&source);
        return;
    }

    let dest_alpha = target[dest + 3] as f32 / 255.0;
    let out_alpha = source_alpha + dest_alpha * (1.0 - source_alpha);
    target[dest] = ((source[0] as f32 * source_alpha + target[dest] as f32 * dest_alpha * (1.0 - source_alpha)) / out_alpha).round() as u8;
    target[dest + 1] = ((source[1] as f32 * source_alpha + target[dest + 1] as f32 * dest_alpha * (1.0 - source_alpha)) / out_alpha).round() as u8;
    target[dest + 2] = ((source[2] as f32 * source_alpha + target[dest + 2] as f32 * dest_alpha * (1.0 - source_alpha)) / out_alpha).round() as u8;
    target[dest + 3] = (out_alpha * 255.0).round() as u8;
}
