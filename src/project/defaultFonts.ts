import { parseYaff } from "./bitmapFont.ts";
import type { FontAsset } from "./model.ts";

const msxInternationalGlyphHex: [string, string][] = [
  [" ", "0000000000000000"],
  ["!", "2020202000002000"],
  ["\"", "5050500000000000"],
  ["#", "5050f850f8505000"],
  ["$", "2078a07028f02000"],
  ["%", "c0c8102040981800"],
  ["&", "40a040a890986000"],
  ["'", "1020400000000000"],
  ["(", "1020404040201000"],
  [")", "4020101010204000"],
  ["*", "20a8702070a82000"],
  ["+", "002020f820200000"],
  [",", "0000000000202040"],
  ["-", "0000007800000000"],
  [".", "0000000000606000"],
  ["/", "0000081020408000"],
  ["0", "708898a8c8887000"],
  ["1", "2060a0202020f800"],
  ["2", "708808106080f800"],
  ["3", "7088083008887000"],
  ["4", "10305090f8101000"],
  ["5", "f880e0100810e000"],
  ["6", "304080f088887000"],
  ["7", "f888102020202000"],
  ["8", "7088887088887000"],
  ["9", "7088887808106000"],
  [":", "0000200000200000"],
  [";", "0000200000202040"],
  ["<", "183060c060301800"],
  ["=", "0000f800f8000000"],
  [">", "c06030183060c000"],
  ["?", "7088081020002000"],
  ["@", "70880868a8a87000"],
  ["A", "20508888f8888800"],
  ["B", "f04848704848f000"],
  ["C", "3048808080483000"],
  ["D", "e05048484850e000"],
  ["E", "f88080f08080f800"],
  ["F", "f88080f080808000"],
  ["G", "708880b888887000"],
  ["H", "888888f888888800"],
  ["I", "7020202020207000"],
  ["J", "3810101090906000"],
  ["K", "8890a0c0a0908800"],
  ["L", "808080808080f800"],
  ["M", "88d8a8a888888800"],
  ["N", "88c8c8a898988800"],
  ["O", "7088888888887000"],
  ["P", "f08888f080808000"],
  ["Q", "70888888a8906800"],
  ["R", "f08888f0a0908800"],
  ["S", "7088807008887000"],
  ["T", "f820202020202000"],
  ["U", "8888888888887000"],
  ["V", "8888888850502000"],
  ["W", "888888a8a8d88800"],
  ["X", "8888502050888800"],
  ["Y", "8888887020202000"],
  ["Z", "f80810204080f800"],
  ["[", "7040404040407000"],
  ["\\", "0000804020100800"],
  ["]", "7010101010107000"],
  ["^", "2050880000000000"],
  ["_", "000000000000f800"],
  ["`", "4020100000000000"],
  ["a", "0000700878887800"],
  ["b", "8080b0c888c8b000"],
  ["c", "0000708880887000"],
  ["d", "0808689888986800"],
  ["e", "00007088f8807000"],
  ["f", "102820f820202000"],
  ["g", "0000689898680870"],
  ["h", "8080f08888888800"],
  ["i", "2000602020207000"],
  ["j", "1000301010109060"],
  ["k", "4040485060504800"],
  ["l", "6020202020207000"],
  ["m", "0000d0a8a8a8a800"],
  ["n", "0000b0c888888800"],
  ["o", "0000708888887000"],
  ["p", "0000b0c8c8b08080"],
  ["q", "0000689898680808"],
  ["r", "0000b0c880808000"],
  ["s", "00007880f008f000"],
  ["t", "4040f04040483000"],
  ["u", "0000909090906800"],
  ["v", "0000888888502000"],
  ["w", "000088a8a8a85000"],
  ["x", "0000885020508800"],
  ["y", "0000888898680870"],
  ["z", "0000f8102040f800"],
  ["{", "1820204020201800"],
  ["|", "2020200020202000"],
  ["}", "c02020102020c000"],
  ["~", "40a8100000000000"],
];

const msxInternationalYaffSource = createYaffSource();
const parsedMsxInternational = parseYaff(msxInternationalYaffSource);

export const defaultMsxFont: FontAsset = {
  id: "msx_international_8x8",
  name: "MSX International 8x8",
  source: {
    filename: "msx-international.yaff",
    mimeType: "font/yaff",
    data: [...new TextEncoder().encode(msxInternationalYaffSource)],
  },
  lineHeight: parsedMsxInternational.lineHeight,
  glyphs: parsedMsxInternational.glyphs,
};

function createYaffSource(): string {
  return [
    "name: MSX International 8x8",
    "spacing: character-cell",
    "raster-size: 8 8",
    "converter: scratch96 default font subset from hoard-of-bitfonts msx/msx-international.yaff",
    "source-name: uk1msx048.ic37",
    "source-format: raw binary",
    "",
    ...msxInternationalGlyphHex.flatMap(([character, hex]) => [
      `# ${labelFor(character)}`,
      `u+${character.codePointAt(0)?.toString(16).padStart(4, "0")}:`,
      ...rowsFromHex(hex).map((row) => `    ${row}`),
      "",
    ]),
  ].join("\n");
}

function rowsFromHex(hex: string): string[] {
  const rows: string[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    const value = Number.parseInt(hex.slice(index, index + 2), 16);
    rows.push(value.toString(2).padStart(8, "0").replaceAll("0", ".").replaceAll("1", "@"));
  }
  return rows;
}

function labelFor(character: string): string {
  return character === " " ? "SPACE" : character;
}
