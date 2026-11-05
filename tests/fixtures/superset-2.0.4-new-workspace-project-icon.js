  const projects = reactExports.useMemo(() => hostProjects.filter((project2) => Boolean(project2.projectKey)).map((project2) => ({
    id: project2.projectKey,
    name: project2.name,
    githubOwner: project2.repoOwner,
    githubRepoName: project2.repoName,
    iconUrl: project2.repoOwner ? `https://github.com/${project2.repoOwner}.png?size=64` : null,
    needsSetup: setUpProjectIds === null ? null : !setUpProjectIds.has(project2.projectKey)
  })), [hostProjects, setUpProjectIds]);
