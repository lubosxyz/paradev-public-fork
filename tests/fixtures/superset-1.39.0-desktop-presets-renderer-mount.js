function createOrgCollections(organizationId) {
  const v2SidebarProjects = createIndexedCollection(localStorageCollectionOptions(hardenLocalCollection({
    id: `v2_sidebar_projects-${organizationId}`,
    storageKey: `v2-sidebar-projects-${organizationId}`,
    schema: dashboardSidebarProjectSchema,
    // Explicit type for the same reason `withReadHeal` needs one: a
    // passthrough generic drops the contextual typing that would
    // otherwise narrow the key to string.
    getKey: (item) => item.projectId
  })));
  v2SidebarProjects.createIndex((sidebarProject) => sidebarProject.tabOrder, basicIndexConfig);
  const v2WorkspaceLocalState = createIndexedCollection(localStorageCollectionOptions(hardenLocalCollection({
    id: `v2_workspace_local_state-${organizationId}`,
    storageKey: `v2-workspace-local-state-${organizationId}`,
    schema: workspaceLocalStateSchema,
    // Explicit type so `withReadHeal`'s passthrough generic keeps the
    // linkage between schema and getKey for downstream inference.
    getKey: (item) => item.workspaceId
  }, healWorkspaceLocalState)));
  v2WorkspaceLocalState.createIndex((localState) => localState.sidebarState.projectId, basicIndexConfig);
  v2WorkspaceLocalState.createIndex((localState) => localState.sidebarState.sectionId, basicIndexConfig);
  v2WorkspaceLocalState.createIndex((localState) => localState.sidebarState.tabOrder, basicIndexConfig);
  const v2SidebarSections = createIndexedCollection(localStorageCollectionOptions(hardenLocalCollection({
    id: `v2_sidebar_sections-${organizationId}`,
    storageKey: `v2-sidebar-sections-${organizationId}`,
    schema: dashboardSidebarSectionSchema,
    getKey: (item) => item.sectionId
  })));
  v2SidebarSections.createIndex((section) => section.projectId, basicIndexConfig);
  v2SidebarSections.createIndex((section) => section.tabOrder, basicIndexConfig);
  const v2TerminalPresets = createIndexedCollection(localStorageCollectionOptions(hardenLocalCollection({
    id: `v2_terminal_presets-${organizationId}`,
    storageKey: `v2-terminal-presets-${organizationId}`,
    schema: v2TerminalPresetSchema,
    getKey: (item) => item.id
  })));
  const v2UserPreferences = createCollection$1(localStorageCollectionOptions(hardenLocalCollection({
    id: `v2_user_preferences-${organizationId}`,
    storageKey: `v2-user-preferences-${organizationId}`,
    schema: v2UserPreferencesSchema,
    // Cast widens the inferred literal "preferences" key to string so
    // the collection slots into the shared OrgCollections.{...<TKey=string>}
    // shape alongside the other v2 collections. Explicit `item` type so
    // `withReadHeal`'s passthrough generic keeps schema/getKey linkage.
    getKey: (item) => item.id
  }, healV2UserPreferences)));
  const failedWorkspaceCreates = createIndexedCollection(localStorageCollectionOptions(hardenLocalCollection({
    id: `failed_workspace_creates-${organizationId}`,
    storageKey: `failed-workspace-creates-${organizationId}`,
    schema: failedWorkspaceCreateSchema,
    getKey: (item) => item.id
  })));
  return {
    v2SidebarProjects,
    v2WorkspaceLocalState,
    v2SidebarSections,
    v2TerminalPresets,
    v2UserPreferences,
    failedWorkspaceCreates
  };
}
async function preloadCollections(organizationId) {
  const collections2 = getCollections(organizationId);
  for (const [name2, collection] of Object.entries(collections2)) {
    collection.preload().catch((error2) => {
      console.error(`[collections] Preload failed: ${name2}`, error2);
    });
  }
}
function getCollections(organizationId) {
  const cacheKey2 = getCollectionsCacheKey(organizationId);
  if (!collectionsCache.has(cacheKey2)) {
    collectionsCache.set(cacheKey2, createOrgCollections(organizationId));
  }
  const orgCollections = collectionsCache.get(cacheKey2);
  if (!orgCollections) {
    throw new Error(`Collections not found for org: ${organizationId}`);
  }
  return {
    ...orgCollections
  };
}
function evictInactiveOrgCollections(activeOrganizationId) {
  evictInactiveOrgs(collectionsCache, getCollectionsCacheKey(activeOrganizationId), (orgKey, collectionName, error2) => {
    console.error(`[collections] Failed to clean up evicted collection ${collectionName} for org ${orgKey}`, error2);
  });
}
const ORG_SCOPED_CLOUD_ROUTERS = new Set(CLOUD_TRPC_ROUTER_ROOTS);
function dropCloudQueriesForOrgSwitch() {
  queryClient.removeQueries({
    predicate: (query) => {
      const [head2, second] = query.queryKey;
      if (Array.isArray(head2)) {
        return typeof head2[0] === "string" && ORG_SCOPED_CLOUD_ROUTERS.has(head2[0]);
      }
      return head2 === CLOUD_QUERY_KEY_ROOT && typeof second === "string" && ORG_SCOPED_CLOUD_ROUTERS.has(second);
    }
  });
}
const CollectionsContext = reactExports.createContext(null);
function preloadActiveOrganizationCollections(activeOrganizationId) {
  if (!activeOrganizationId) return;
  void preloadCollections(activeOrganizationId).catch((error2) => {
    console.error("[collections-provider] Failed to preload active org collections:", error2);
  });
}
function CollectionsProvider({
  children: children2
}) {
  const {
    data: session
  } = authClient.useSession();
  const switchInFlightRef = reactExports.useRef(false);
  const recordActiveOrganizationRef = reactExports.useRef(Promise.resolve());
  const {
    data: windowOrgId,
    isPending: windowOrgPending
  } = electronTrpc.window.getActiveOrg.useQuery();
  const sessionOrgId = session?.session?.activeOrganizationId;
  const [activeOrganizationId, setActiveOrganizationId] = reactExports.useState(null);
  const {
    data: organizations
  } = cloudTrpc.organization.list.useQuery(void 0);
  const initializedRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (initializedRef.current) return;
    if (windowOrgPending) return;
    const registryOrgIsStillMine = windowOrgId != null && organizations != null && organizations.some((organization) => organization.id === windowOrgId);
    if (windowOrgId != null && organizations == null) return;
    const resolved = (registryOrgIsStillMine ? windowOrgId : sessionOrgId) ?? null;
    if (!resolved) return;
    initializedRef.current = true;
    setActiveOrganizationId(resolved);
  }, [windowOrgPending, windowOrgId, sessionOrgId, organizations]);
  setCloudOrganizationId(activeOrganizationId);
  reactExports.useEffect(() => {
    if (!activeOrganizationId) return;
    void electronTrpcClient.window.setActiveOrg.mutate({
      organizationId: activeOrganizationId
    }).catch((error2) => {
      console.error("[collections-provider] Failed to sync window org to registry:", error2);
    });
  }, [activeOrganizationId]);
  const switchOrganization = reactExports.useCallback(async (organizationId) => {
    if (organizationId === activeOrganizationId) return;
    if (switchInFlightRef.current) return;
    switchInFlightRef.current = true;
    try {
      await preloadCollections(organizationId);
      setActiveOrganizationId(organizationId);
      recordActiveOrganizationRef.current = recordActiveOrganizationRef.current.then(async () => {
        const {
          error: error2
        } = await authClient.organization.setActive({
          organizationId
        });
        if (error2) throw error2;
      }).catch((error2) => {
        console.error("[collections-provider] Failed to record the active organization:", error2);
      });
    } catch (error2) {
      console.error("[collections-provider] Failed to switch organization:", error2);
    } finally {
      switchInFlightRef.current = false;
    }
  }, [activeOrganizationId]);
  const previousOrganizationIdRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    preloadActiveOrganizationCollections(activeOrganizationId);
    if (activeOrganizationId) {
      evictInactiveOrgCollections(activeOrganizationId);
      if (previousOrganizationIdRef.current && previousOrganizationIdRef.current !== activeOrganizationId) {
        dropCloudQueriesForOrgSwitch();
      }
      previousOrganizationIdRef.current = activeOrganizationId;
    }
  }, [activeOrganizationId]);
  const collections2 = reactExports.useMemo(() => activeOrganizationId ? getCollections(activeOrganizationId) : null, [activeOrganizationId]);
  const contextValue = reactExports.useMemo(() => collections2 && activeOrganizationId ? {
    ...collections2,
    activeOrganizationId,
    switchOrganization
  } : null, [collections2, activeOrganizationId, switchOrganization]);
  if (!contextValue) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(CollectionsContext.Provider, { value: contextValue, children: children2 });
}
function useCollections() {
  const context = reactExports.useContext(CollectionsContext);
  if (!context) {
    throw new Error("useCollections must be used within CollectionsProvider");
  }
  return context;
}
