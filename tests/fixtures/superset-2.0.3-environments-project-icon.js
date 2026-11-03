function projectIconUrl(project) {
  if (project.icon) return project.icon;
  return project.repoOwner ? `https://github.com/${project.repoOwner}.png?size=64` : null;
}
