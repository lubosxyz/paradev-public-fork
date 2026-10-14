!(function() {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {};
    e.SENTRY_RELEASE = { id: "1.37.0" };
    var n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "7a5ffc8c-1679-4648-8f01-f16e5cd5aa6e", e._sentryDebugIdIdentifier = "sentry-dbid-7a5ffc8c-1679-4648-8f01-f16e5cd5aa6e");
  } catch (e2) {
  }
})();
import "./index-CDLUicRv.js";
const PROJECT_ICON_NONE = "none";
function resolveProjectIconUrl(project) {
  if (project.icon === PROJECT_ICON_NONE) return null;
  if (project.icon) return project.icon;
  if (project.repoOwner) {
    return `https://github.com/${project.repoOwner}.png?size=64`;
  }
  return null;
}
export {
  PROJECT_ICON_NONE as P,
  resolveProjectIconUrl as r
};
//# sourceMappingURL=resolveProjectIconUrl-Ura01BN1.js.map
