// Every test of palette_search.test.mjs on the desktop-v2.0.0 bytes (LUBOS-3343): the patched 2.0.0
// regions 2 and 3 (region 1 is byte-identical to 1.37.0, region 4 to 1.39.0) and the 2.0.0 hotkey
// registry (the 1.40.0 one plus TOGGLE_RIGHT_PANE_FULL_SCREEN on Cmd+Shift+L, OPEN_DIFF_VIEWER on Cmd+Shift+G).
globalThis.SSP_PALETTE_RELEASE = "2.0.0";
await import("./palette_search.test.mjs?release=2.0.0");
