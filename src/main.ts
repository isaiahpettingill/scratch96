import { createApp, defineScratch96Elements } from "./app.ts";
import "./app.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

defineScratch96Elements();
root.append(createApp());
