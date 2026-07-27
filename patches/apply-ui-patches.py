#!/usr/bin/env python3
"""Apply lubos' Superset UI customizations to an EXTRACTED dist tree.

Works on plain files (no asar length constraints). Two usages:

  1. Against an extracted asar tree before repacking:
       python3 apply-ui-patches.py /path/to/extracted-root   # contains dist/
  2. Against a source-build output dir that has dist/renderer + dist/main:
       python3 apply-ui-patches.py /path/to/apps/desktop     # contains dist/

Patches applied (v1.17.x renderer):
  A. Project icons: sidebar composes superset-icon://projects/<key> instead of
     GitHub avatars (custom icons live in ~/.superset/project-icons/).
  B. Icon sizes: v1 thumbnail/chevron size-4 -> size-5; dashboard expanded row
     size-5 -> size-6 (match collapsed rail).
  C. Dashboard sidebar markers for CSS: topnav, kids, sbroot, projhdr, sbfoot,
     OrganizationDropdown collapsed variant, project row pl-2.
  D. No icon->chevron swap on project row hover.
  E. index.html <style> block (topnav icon row + tooltips, right-corner
     hover cluster, active-session stripe+gradient, hover gradient tween).

Idempotent: each replacement is skipped when the target string is absent and
the patched form is already present.
"""
import sys, os, re, glob

CSS = (
    "<style>"
    ".topnav{flex-direction:row;gap:2px;padding:2px 38px 4px 8px;flex-wrap:wrap}"
    ".topnav>div:first-child{flex-basis:100%}"
    ".topnav>button{width:30px;height:30px;justify-content:center;padding:0;position:relative}"
    ".topnav>button>span{display:none}"
    ".topnav>button:hover>span:first-of-type{display:flex;position:absolute;top:100%;left:0;z-index:9;background:var(--color-popover);color:var(--color-popover-foreground);padding:2px 6px;font-size:11px;white-space:nowrap;pointer-events:none;border-radius:6px}"
    ".kids{padding-bottom:4px}"
    ".kids [class*=pl-5]{padding-left:19px}"
    ".sbroot{position:relative;border-right:1px solid var(--color-border)}"
    ".sbroot [class*=min-h-10]{padding-left:12px}"
    ".sbfoot,.projhdr{position:absolute;right:4px;z-index:9;border-radius:8px}"
    ".sbfoot{top:36px;gap:2px}"
    ".sbfoot>*:not(:last-child){display:none}"
    ".sbfoot:hover{background:var(--color-popover)}"
    ".sbfoot:hover>*,.sbroot:has(.projhdr:hover) .sbfoot>*{display:flex}"
    ".projhdr{top:36px;right:66px;display:none;background:var(--color-popover)}"
    ".sbroot:has(.sbfoot:hover) .projhdr,.projhdr:hover{display:flex}"
    ".projhdr>:not(:last-child){display:none}"
    '.kids [class*="w-0.5"]{background:#c2410c!important}'
    '.kids div:has(>[class*=rounded-r][class*="w-0.5"]){background:linear-gradient(90deg,#88888826,#0000 75%)}'
    ".sbroot :is(button,[role=button]){background-image:linear-gradient(90deg,#8888881a,#0000 75%);background-repeat:no-repeat;background-size:200%;background-position:160%;transition:background-position .41s ease-in-out}"
    ".sbroot :is(button,[role=button]):hover{background-position:0;transition:background-position .33s cubic-bezier(.2,.8,.2,1)}"
    "</style>"
)

# (old, new, min_expected) — applied to all renderer JS bundles
JS_SUBS = [
    # A. icon source
    ('https://github.com/${project.repoOwner}.png?size=64',
     'superset-icon://projects/${project.projectKey}?v=64', 1),
    # B. v1 thumbnail + chevron size bump (patch-asar.py heritage)
    ('"relative size-4 rounded overflow-hidden flex-shrink-0"',
     '"relative size-5 rounded overflow-hidden flex-shrink-0"', 0),
    ('"size-4 shrink-0 text-muted-foreground transition-transform duration-200"',
     '"size-5 shrink-0 text-muted-foreground transition-transform duration-200"', 0),
    # B. dashboard expanded row -> size-6
    ('"flex size-5 shrink-0 items-center justify-center"',
     '"flex size-6 shrink-0 items-center justify-center"', 1),
    ('className: "size-5 group-hover:hidden"',
     'className: "size-6"', 0),
    ('"hidden size-5 text-muted-foreground transition-transform group-hover:block"',
     '"hidden size-6 text-muted-foreground transition-transform"', 0),
    ('className: "size-4 group-hover:hidden"',
     'className: "size-6"', 0),
    ('"hidden size-4 text-muted-foreground transition-transform group-hover:block"',
     '"hidden size-6 text-muted-foreground transition-transform"', 0),
    ('"flex size-4 shrink-0 items-center justify-center"',
     '"flex size-6 shrink-0 items-center justify-center"', 0),
    # C. markers
    ('"flex flex-col gap-1 px-3 pt-2 pb-2"',
     '"topnav flex flex-col gap-1 px-3"', 1),
    ('className: "pb-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(\n        DndContext',
     'className: "kids", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(\n        DndContext', 1),
    ('"flex h-full flex-col border-r border-border bg-muted/45 dark:bg-muted/35"',
     '"sbroot flex h-full flex-col border-border bg-muted/45 dark:bg-muted/35"', 1),
    ('"group flex min-h-8 w-full shrink-0 items-center gap-1.5 py-1.5 pl-5 pr-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50"',
     '"projhdr flex items-center"', 1),
    ('"flex items-center gap-1 p-3"', '"sbfoot flex items-center"', 1),
    ('OrganizationDropdown, { variant: "expanded" }',
     'OrganizationDropdown, { variant: "collapsed" }', 1),
    ('"group flex min-h-10 w-full items-center pl-5 pr-2 py-1.5 text-sm font-medium"',
     '"group flex min-h-10 w-full items-center pl-2 pr-2 py-1.5 text-sm font-medium"', 1),
]


def patch_file(path, subs):
    try:
        txt = open(path, encoding="utf-8", errors="surrogateescape").read()
    except (UnicodeDecodeError, IsADirectoryError):
        return {}
    hits = {}
    for old, new, _need in subs:
        n = txt.count(old)
        if n:
            txt = txt.replace(old, new)
            hits[old[:50]] = n
    if hits:
        open(path, "w", encoding="utf-8", errors="surrogateescape").write(txt)
    return hits


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    dist = os.path.join(root, "dist")
    if not os.path.isdir(dist):
        sys.exit(f"no dist/ under {root}")

    totals = {}
    targets = glob.glob(os.path.join(dist, "renderer", "assets", "*.js")) + \
              glob.glob(os.path.join(dist, "renderer", "assets", "*.js.map")) + \
              glob.glob(os.path.join(dist, "main", "*.js"))
    for p in targets:
        for k, n in patch_file(p, JS_SUBS).items():
            totals[k] = totals.get(k, 0) + n

    for old, new, need in JS_SUBS:
        got = totals.get(old[:50], 0)
        status = "OK " if got >= need else ("MISS" if need else "n/a ")
        print(f"  [{status}] {got}x {old[:58]}")

    # E. index.html style injection (idempotent)
    idx = os.path.join(dist, "renderer", "index.html")
    if os.path.exists(idx):
        html = open(idx).read()
        html = re.sub(r"<style>\.topnav\{.*?</style>", "", html, flags=re.S)
        html = html.replace("</head>", CSS + "\n  </head>", 1)
        open(idx, "w").write(html)
        print("  [OK ] index.html style block injected")
    else:
        print("  [MISS] dist/renderer/index.html not found")


if __name__ == "__main__":
    main()
