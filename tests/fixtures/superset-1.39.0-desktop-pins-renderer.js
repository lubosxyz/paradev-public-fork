function LocalHostServiceProvider({
  children
}) {
  const utils = electronTrpc.useUtils();
  const {
    data: activeOrganization
  } = authClient.useActiveOrganization();
  const {
    data: session
  } = authClient.useSession();
  const authToken = useAuthToken();
  const {
    mutateAsync: persistOrganizationIds
  } = electronTrpc.auth.persistOrganizationIds.useMutation({
    networkMode: "always",
    retry: 3,
    onError: (error) => {
      console.error("[host-service] failed to persist organization membership", error);
    }
  });
  const {
    activeOrganizationId: windowOrganizationId
  } = useCollections();
  const activeOrganizationId = windowOrganizationId ?? null;
  const organizationIds = session?.session?.organizationIds;
  const sessionToken = session?.session?.token ?? null;
  const organizationIdsJson = organizationIds ? JSON.stringify([...new Set(organizationIds)].sort()) : null;
  const stableOrganizationIds = reactExports.useMemo(() => {
    if (organizationIdsJson === null) return null;
    return JSON.parse(organizationIdsJson);
  }, [organizationIdsJson]);
  const membershipVersion = authToken && organizationIdsJson ? JSON.stringify([authToken, organizationIdsJson]) : null;
  const currentMembershipVersionRef = reactExports.useRef(membershipVersion);
  currentMembershipVersionRef.current = membershipVersion;
  const membershipRevisionRef = reactExports.useRef({
    token: authToken,
    revision: 0
  });
  if (membershipRevisionRef.current.token !== authToken) {
    membershipRevisionRef.current = {
      token: authToken,
      revision: 0
    };
  }
  const lastPersistedMembershipRef = reactExports.useRef(null);
  const persistMembership = reactExports.useCallback(async () => {
    if (!stableOrganizationIds || !authToken || !membershipVersion || lastPersistedMembershipRef.current === membershipVersion || sessionToken !== authToken) {
      return;
    }
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await persistOrganizationIds({
          token: authToken,
          organizationIds: stableOrganizationIds,
          expectedRevision: membershipRevisionRef.current.revision
        });
        if (membershipRevisionRef.current.token !== authToken) return;
        if (result.status === "token-mismatch") return;
        membershipRevisionRef.current.revision = Math.max(membershipRevisionRef.current.revision, result.revision);
        if (result.status === "saved") {
          if (currentMembershipVersionRef.current === membershipVersion) {
            lastPersistedMembershipRef.current = membershipVersion;
          }
          return;
        }
        if (currentMembershipVersionRef.current !== membershipVersion) return;
      }
      console.error("[host-service] membership changed too frequently to persist");
    } catch {
    }
  }, [authToken, membershipVersion, persistOrganizationIds, sessionToken, stableOrganizationIds]);
  reactExports.useEffect(() => {
    void persistMembership();
  }, [persistMembership]);
  const {
    data: machineIdData
  } = electronTrpc.device.getMachineId.useQuery(void 0, {
    staleTime: Number.POSITIVE_INFINITY
  });
  reactExports.useEffect(() => {
    if (machineIdData?.machineId) {
      setClientMachineId(machineIdData.machineId);
    }
  }, [machineIdData]);
  const sessionUserId = session?.user.id ?? null;
  reactExports.useEffect(() => {
    setClientUserId(sessionUserId);
    return () => setClientUserId(null);
  }, [sessionUserId]);
  const {
    data: activeConnection
  } = electronTrpc.hostServiceCoordinator.getConnection.useQuery({
    organizationId: activeOrganizationId
  }, {
    enabled: !!activeOrganizationId,
    refetchInterval: 5e3
  });
  const {
    data: processStatus
  } = electronTrpc.hostServiceCoordinator.getProcessStatus.useQuery({
    organizationId: activeOrganizationId
  }, {
    enabled: !!activeOrganizationId,
    refetchInterval: activeConnection?.port ? false : 1e3
  });
  electronTrpc.hostServiceCoordinator.onStatusChange.useSubscription(void 0, {
    onData: (event) => {
      if (event.organizationId !== activeOrganizationId) return;
      utils.hostServiceCoordinator.getConnection.invalidate();
      utils.hostServiceCoordinator.getProcessStatus.invalidate();
    }
  });
  reactExports.useEffect(() => {
    if (!activeConnection?.port) return;
    reconnectEventBusIfDown(`http://127.0.0.1:${activeConnection.port}`);
  }, [activeConnection]);
  const waitForHostReady = reactExports.useCallback(async (timeoutMs = 2e4) => {
    const orgId = activeOrganizationId;
    if (!orgId) return null;
    await persistMembership();
    const tryGetHostUrl = async () => {
      try {
        const connection = await utils.hostServiceCoordinator.getConnection.fetch({
          organizationId: orgId
        });
        if (connection?.port) {
          const hostUrl = `http://127.0.0.1:${connection.port}`;
          if (connection.secret) setHostServiceSecret(hostUrl, connection.secret);
          return hostUrl;
        }
      } catch (error) {
        console.warn("[host-service] connection poll failed:", error);
      }
      return null;
    };
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hostUrl = await tryGetHostUrl();
      if (hostUrl) return hostUrl;
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    return await tryGetHostUrl();
  }, [activeOrganizationId, persistMembership, utils]);
  const activeOrganizationName = activeOrganization?.name ?? null;
  const value = reactExports.useMemo(() => {
    if (!machineIdData) return null;
    const machineId = machineIdData.machineId;
    const hostServiceStatus = activeConnection?.port != null ? "running" : processStatus?.status ?? "unknown";
    if (!activeConnection?.port) {
      return {
        machineId,
        activeHostUrl: null,
        activeOrganizationId: activeOrganizationId ?? null,
        activeOrganizationName,
        hostServiceStatus,
        waitForHostReady
      };
    }
    const activeHostUrl = `http://127.0.0.1:${activeConnection.port}`;
    if (activeConnection.secret) {
      setHostServiceSecret(activeHostUrl, activeConnection.secret);
    }
    return {
      machineId,
      activeHostUrl,
      activeOrganizationId: activeOrganizationId ?? null,
      activeOrganizationName,
      hostServiceStatus,
      waitForHostReady
    };
  }, [machineIdData, activeConnection, activeOrganizationId, activeOrganizationName, processStatus?.status, waitForHostReady]);
  if (!value) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(LocalHostServiceContext.Provider, { value, children });
}
