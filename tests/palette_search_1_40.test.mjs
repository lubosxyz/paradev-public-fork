// Every test of palette_search.test.mjs on the desktop-v1.40.0 bytes (LUBOS-3122): the patched 1.40.0
// region 2 (region 1 is byte-identical to 1.37.0, region 3 to 1.38.0, region 4 to 1.39.0) and the 1.40.0
// hotkey registry (the 1.38.0 one plus NEW_CHAT).
globalThis.SSP_PALETTE_RELEASE = "1.40.0";
await import("./palette_search.test.mjs?release=1.40.0");
