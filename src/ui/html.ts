export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

export function sourceDataUrl(source: { mimeType: string; data: number[] }): string {
  let binary = "";

  for (const byte of source.data) {
    binary += String.fromCharCode(byte);
  }

  return `data:${source.mimeType};base64,${btoa(binary)}`;
}
