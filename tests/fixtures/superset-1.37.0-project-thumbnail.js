!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "1.37.0" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "6f27f3aa-7fb5-4d81-8f6c-79c597d32bce", e._sentryDebugIdIdentifier = "sentry-dbid-6f27f3aa-7fb5-4d81-8f6c-79c597d32bce");
  } catch (e2) {
  }
})();
import { r as reactExports, j as jsxRuntimeExports, d as cn } from "./index-CDLUicRv.js";
function hexToRgba(hex, alpha) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function isHexColor(color) {
  return !!color && /^#[0-9a-fA-F]{6}$/.test(color);
}
function ProjectThumbnail({
  projectName,
  iconUrl,
  color,
  className
}) {
  const [failedUrl, setFailedUrl] = reactExports.useState(null);
  const firstLetter = projectName.charAt(0).toUpperCase();
  const hasColor = isHexColor(color);
  if (iconUrl && failedUrl !== iconUrl) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("relative size-6 rounded-sm overflow-hidden flex-shrink-0 bg-muted border", hasColor ? void 0 : "border-foreground/10", className), style: hasColor ? {
      borderColor: hexToRgba(color, 0.6)
    } : void 0, children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: iconUrl, alt: `${projectName} icon`, className: "size-full object-cover", onError: () => setFailedUrl(iconUrl) }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("size-6 rounded-sm flex items-center justify-center flex-shrink-0", "text-xs font-medium border", hasColor ? void 0 : "bg-muted text-muted-foreground border-foreground/10", className), style: hasColor ? {
    borderColor: hexToRgba(color, 0.6),
    backgroundColor: hexToRgba(color, 0.15),
    color
  } : void 0, children: firstLetter });
}
export {
  ProjectThumbnail as P
};
//# sourceMappingURL=ProjectThumbnail-CDXDZ9LB.js.map
