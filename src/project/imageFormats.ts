export const supportedImageAccept = [
  "image/*",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpg",
  ".jpeg",
  ".pam",
  ".pbm",
  ".pgm",
  ".png",
  ".ppm",
  ".qoi",
  ".tga",
  ".tif",
  ".tiff",
  ".webp",
].join(",");

const supportedImageExtensionPattern =
  /\.(avif|bmp|gif|heic|heif|jpe?g|pam|pbm|pgm|png|ppm|qoi|tga|tiff?|webp)$/i;

export function isSupportedImageFile(file: File): boolean {
  return file.type.startsWith("image/") || supportedImageExtensionPattern.test(file.name);
}
