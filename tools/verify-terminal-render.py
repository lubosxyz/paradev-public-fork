#!/usr/bin/env python3
"""Superset terminal render verification (replay duplication / corruption).

Prereq: Superset launched with a debug port:
    open -a Superset --args --remote-debugging-port=9224

Method (learned the hard way 2026-07-27):
  * Anchors must be written to the pane's TTY, not printed from a tool whose
    stdout is a pipe — piped output never reaches the xterm buffer.
  * Panes of non-active workspaces are not mounted, so the DOM/React walk sees
    nothing. The reliable buffer source is the renderer's own persisted state:
    localStorage["terminal-state-v2:<id>"], which is exactly what the replay
    path writes.
  * Chrome 111+ refuses a CDP websocket carrying an Origin header unless the
    app was started with --remote-allow-origins; connect with
    suppress_origin=True instead of relaunching.

Usage:
    python3 verify-terminal-render.py plant      # write anchors into this TTY
    python3 verify-terminal-render.py check      # count anchors in persisted buffers
    python3 verify-terminal-render.py reload     # force replay, then re-check
    python3 verify-terminal-render.py shot       # screenshot only

A PASS requires the anchors to be FOUND (5 sentinels + 1 DONE, each exactly
once). "No duplicates found" while no anchor exists at all is reported as
INCONCLUSIVE, never as success.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = os.environ.get("SUPERSET_CDP_PORT", "9224")
SENTINELS = 5

try:
    import websocket
except ImportError:
    sys.exit("pip3 install websocket-client")


def page_ws():
    pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=5))
    cands = [p for p in pages if p.get("type") == "page" and "index.html" in p.get("url", "")]
    if not cands:
        sys.exit(f"No Superset renderer page on port {PORT} — launch with --remote-debugging-port={PORT}")
    return websocket.create_connection(cands[0]["webSocketDebuggerUrl"], timeout=30,
                                       suppress_origin=True)


class CDP:
    def __init__(self):
        self.ws = page_ws()
        self.mid = 0

    def call(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.mid:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m.get("result", {})

    def eval(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)["result"]
        if r.get("subtype") == "error":
            raise RuntimeError(r.get("description"))
        return r.get("value")


SCAN = r"""
(() => {
  const out = [];
  for (const k of Object.keys(localStorage)) {
    if (!/^terminal-(state-v2|buffer):/.test(k)) continue;
    let raw = localStorage.getItem(k) || '', txt = raw;
    if (k.startsWith('terminal-state-v2:')) {
      try { const o = JSON.parse(raw); txt = o.buffer ?? o.data ?? raw; } catch {}
    }
    const clean = txt.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
    const per = [];
    for (let i = 1; i <= 5; i++) {
      const exact = (clean.match(new RegExp(`SENTINEL-${i}-ABCDEFGHIJKLMNOPQRSTUVWXYZ`, 'g')) || []).length;
      const loose = (clean.match(new RegExp(`SENTINEL-${i}-`, 'g')) || []).length;
      per.push({i, exact, loose});
    }
    const done = (clean.match(/DONE tui-stress/g) || []).length;
    const collided = /SENTINEL-\d-.*SENTINEL-\d-/.test(clean);
    if (per.some(p => p.loose) || done) out.push({k, per, done, collided, bytes: raw.length});
  }
  return JSON.stringify(out);
})()
"""


def my_tty():
    """Walk up the process tree to the first ancestor owning a TTY."""
    pid = os.getppid()
    for _ in range(8):
        try:
            tty = subprocess.check_output(["ps", "-o", "tty=", "-p", str(pid)], text=True).strip()
            if tty and tty != "??":
                return f"/dev/{tty}"
            pid = int(subprocess.check_output(["ps", "-o", "ppid=", "-p", str(pid)], text=True).strip())
        except Exception:
            break
    return None


def plant():
    tty = my_tty()
    if not tty:
        sys.exit("No TTY found in the process ancestry — cannot plant anchors.")
    with open(tty, "w") as f:
        f.write("\n")
        for i in range(1, SENTINELS + 1):
            f.write(f"SENTINEL-{i}-ABCDEFGHIJKLMNOPQRSTUVWXYZ\n")
        f.write("DONE tui-stress\n")
    print(f"anchors written to {tty}")


def check(label="check"):
    rows = json.loads(CDP().eval(SCAN) or "[]")
    if not rows:
        print(f"{label}: INCONCLUSIVE — no persisted buffer contains the anchors. "
              f"Run 'plant' from a shell inside the pane you want to verify.")
        return 2
    failures = []
    for r in rows:
        summary = " ".join(f"S{p['i']}={p['exact']}" for p in r["per"])
        print(f"  {r['k'][:52]}  {summary} DONE={r['done']} ({r['bytes']}B)")
        for p in r["per"]:
            if p["exact"] > 1:
                failures.append(f"SENTINEL-{p['i']} appears {p['exact']}x — replay duplication")
            if p["loose"] != p["exact"]:
                failures.append(f"SENTINEL-{p['i']}: {p['loose']} partial vs {p['exact']} exact — merged/truncated line")
        if r["done"] > 1:
            failures.append(f"DONE marker x{r['done']} — replay duplication")
        if r["collided"]:
            failures.append("two sentinels collided on one row")
    print()
    if failures:
        print(f"{label}: FAIL")
        for f in failures:
            print("  -", f)
        return 1
    print(f"{label}: PASS — anchors intact, each exactly once")
    return 0


def reload_and_check():
    cdp = CDP()
    print("before reload:")
    rows = json.loads(cdp.eval(SCAN) or "[]")
    if not rows:
        print("  INCONCLUSIVE — plant anchors first."); return 2
    cdp.call("Page.reload")
    print("  reload issued; waiting for reconnect + replay + persistence flush")
    deadline = time.time() + 90
    while time.time() < deadline:
        time.sleep(5)
        try:
            if json.loads(CDP().eval(SCAN) or "[]"):
                break
        except Exception:
            pass
    return check("after-reload")


def shot():
    cdp = CDP()
    data = cdp.call("Page.captureScreenshot", format="png")["data"]
    out = os.path.expanduser(f"~/.superset/render-verify-{time.strftime('%Y%m%d-%H%M%S')}.png")
    with open(out, "wb") as f:
        f.write(base64.b64decode(data))
    print(out)
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    sys.exit({"plant": lambda: (plant(), 0)[1], "check": check,
              "reload": reload_and_check, "shot": shot}[cmd]())
