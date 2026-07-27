interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const url: string;
  export default url;
}

declare module "*.c?raw" {
  const source: string;
  export default source;
}

declare module "*.h?raw" {
  const source: string;
  export default source;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "*?url" {
  const url: string;
  export default url;
}
