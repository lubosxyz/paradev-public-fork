// Every test of palette_search.test.mjs on the desktop-v1.39.0 bytes (LUBOS-2797): the patched 1.39.0
// region fixtures (region 1 is byte-identical to 1.37.0, region 3 to 1.38.0) and the 1.38.0 hotkey registry.
globalThis.SSP_PALETTE_RELEASE = "1.39.0";
await import("./palette_search.test.mjs?release=1.39.0");
