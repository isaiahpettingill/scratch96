type CarbonIcon = {
  elem: string;
  attrs: Record<string, string | number>;
  content?: CarbonIcon[];
};

export function carbonIconSvg(icon: CarbonIcon): string {
  const attrs = Object.entries(icon.attrs)
    .map(([name, value]) => `${name}="${escapeHtml(String(value))}"`)
    .join(" ");
  const content = icon.content?.map(carbonIconSvg).join("") ?? "";

  return `<${icon.elem} ${attrs}>${content}</${icon.elem}>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
