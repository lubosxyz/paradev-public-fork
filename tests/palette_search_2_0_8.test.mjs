// Every test of palette_search.test.mjs on the desktop-v2.0.8 bytes (LUBOS-4303): the patched 2.0.8
// regions 1 (chat search results behind the workspace-moves flag), 3 (the ASCII spinner gone) and 4
// (i18n ids), region 2 byte-identical to 2.0.4, and the 2.0.8 hotkey registry (three new entries).
globalThis.SSP_PALETTE_RELEASE = "2.0.8";
await import("./palette_search.test.mjs?release=2.0.8");
