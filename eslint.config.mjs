import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Blob / object-URL previews (images and files stored in IndexedDB) cannot be
      // served through next/image — the optimizer has no fetchable src for them.
      "@next/next/no-img-element": "off",
      // Spatial canvas intentionally manages its own pointer/focus behaviour.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/mouse-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  {
    ignores: [
      ".next/",
      "out/",
      "build/",
      "coverage/",
      "node_modules/",
      "next-env.d.ts",
      "scripts/.cache/",
    ],
  },
]);

export default eslintConfig;
