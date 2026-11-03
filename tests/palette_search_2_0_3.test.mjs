// Every test of palette_search.test.mjs on the desktop-v2.0.3 bytes (LUBOS-3874): the patched 2.0.3
// regions 3 (pause-notifications submenu) and 4 (workspace host glyph moved out), region 2 byte-identical
// to 2.0.0, region 1 to 1.37.0, and the 2.0.0 hotkey registry (byte-identical in 2.0.3).
globalThis.SSP_PALETTE_RELEASE = "2.0.3";
await import("./palette_search.test.mjs?release=2.0.3");
