function DashboardSidebarHoverCardOverlay({
  children
}) {
  const {
    hoveredId,
    anchorElement,
    payload,
    contextMenuOpen,
    hoverCardSuppressed,
    cancelClose,
    requestClose,
    forceClose,
    setCardElement
  } = useDashboardSidebarHover();
  const virtualRef = reactExports.useRef(null);
  virtualRef.current = anchorElement;
  const open = hoveredId !== null && payload !== null && !contextMenuOpen && !hoverCardSuppressed;
  const diffStats = useDiffStats(hoveredId ?? "");
  const [hasPositioned, setHasPositioned] = reactExports.useState(false);
  const frameRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open) {
      setHasPositioned(false);
      return;
    }
    const first = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => setHasPositioned(true));
    });
    frameRef.current = first;
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [open]);
  const contentRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    setCardElement(open && hasPositioned ? contentRef.current : null);
    return () => setCardElement(null);
  }, [open, hasPositioned, setCardElement]);
  return jsxRuntimeExports.jsxs(Popover, { open, onOpenChange: (nextOpen) => {
    if (!nextOpen) forceClose();
  }, children: [
    children,
    jsxRuntimeExports.jsx(PopoverAnchor, { virtualRef }),
    payload && jsxRuntimeExports.jsx(PopoverContent, { ref: contentRef, side: "right", align: "start", className: "w-72", "data-dashboard-sidebar-hover-card": hasPositioned ? "ready" : "", onOpenAutoFocus: (event) => event.preventDefault(), onPointerEnter: cancelClose, onPointerLeave: () => {
      if (hoveredId) requestClose(hoveredId);
    }, children: jsxRuntimeExports.jsx(DashboardSidebarWorkspaceHoverCardContent, { workspace: payload.workspace, diffStats, onEditBranchClick: payload.onEditBranchClick }) })
  ] });
}
// patch-asar.py --sidebar-device-filter
function SdfDeviceItems({ host, devices }) {
  return jsxRuntimeExports.jsxs(DropdownMenuRadioGroup, { value: host ?? "", onValueChange: (value) => sdfSet(value || null), children: [
    jsxRuntimeExports.jsx(DropdownMenuRadioItem, { value: "", children: "All devices" }),
    jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
    devices.map(([id, name, Icon]) => jsxRuntimeExports.jsxs(DropdownMenuRadioItem, { value: id, className: "gap-2", children: [
      jsxRuntimeExports.jsx(Icon, { className: "size-3.5 shrink-0" }),
      jsxRuntimeExports.jsx("span", { className: "truncate", children: name })
    ] }, id))
  ] });
}
function sdfUseCloud(flag, organizationId) {
  const host = sdfUseHost();
  return host !== null && host !== CLOUD_HOST_ID || flag === false || organizationId === null;
}
const DRAG_ACTIVATION_DISTANCE_PX = 5;
function buildTopLevelUnits(list, membership, isSection) {
  const units = [];
  const unitBySection = new Map();
  for (const id of list) {
    if (isSection(id)) {
      const unit = {
        key: id,
        ids: [id]
      };
      units.push(unit);
      unitBySection.set(String(id), unit);
      continue;
    }
    const sectionFlatId = membership[String(id)];
    const owner = sectionFlatId ? unitBySection.get(sectionFlatId) : void 0;
    if (owner) {
      owner.ids.push(id);
    } else {
      units.push({
        key: id,
        ids: [id]
      });
    }
  }
  return units;
}
function findUnitIndex(units, id) {
  return units.findIndex((unit) => unit.key === id || unit.ids.includes(id));
}
function unionRect(rects) {
  let result = null;
  for (const rect of rects) {
    if (!rect) continue;
    if (!result) {
      result = {
        ...rect
      };
      continue;
    }
    const top = Math.min(result.top, rect.top);
    const bottom = Math.max(result.top + result.height, rect.top + rect.height);
    const left = Math.min(result.left, rect.left);
    const right = Math.max(result.left + result.width, rect.left + rect.width);
    result = {
      top,
      left,
      bottom,
      right,
      width: right - left,
      height: bottom - top
    };
  }
  return result;
}
function getUnitGap(unitRects, index, activeIndex) {
  const current = unitRects[index];
  const previous = unitRects[index - 1];
  const next = unitRects[index + 1];
  if (!current) return 0;
  if (activeIndex < index) {
    return previous ? current.top - (previous.top + previous.height) : next ? next.top - (current.top + current.height) : 0;
  }
  return next ? next.top - (current.top + current.height) : previous ? current.top - (previous.top + previous.height) : 0;
}
function createSectionUnitSortingStrategy(items, membership, isSection) {
  const units = buildTopLevelUnits(items, membership, isSection);
  const unitIndexByItemIndex = new Map();
  const indexById = new Map();
  items.forEach((id, index) => {
    indexById.set(id, index);
  });
  units.forEach((unit, unitIndex) => {
    for (const id of unit.ids) {
      const itemIndex = indexById.get(id);
      if (itemIndex != null) unitIndexByItemIndex.set(itemIndex, unitIndex);
    }
  });
  const unitRectsByRects = new WeakMap();
  const getUnitRects = (rects) => {
    let unitRects = unitRectsByRects.get(rects);
    if (!unitRects) {
      unitRects = units.map((u) => unionRect(u.ids.map((id) => {
        const itemIndex = indexById.get(id);
        return itemIndex == null ? void 0 : rects[itemIndex];
      })));
      unitRectsByRects.set(rects, unitRects);
    }
    return unitRects;
  };
  return ({
    activeIndex,
    activeNodeRect: fallbackActiveRect,
    index,
    rects,
    overIndex
  }) => {
    const activeUnit = unitIndexByItemIndex.get(activeIndex);
    const overUnit = unitIndexByItemIndex.get(overIndex);
    const unit = unitIndexByItemIndex.get(index);
    if (activeUnit == null || overUnit == null || unit == null) return null;
    if (!rects[index]) return null;
    const unitRects = getUnitRects(rects);
    const activeRect = unitRects[activeUnit] ?? fallbackActiveRect;
    if (!activeRect) return null;
    const transform = {
      x: 0,
      scaleX: 1,
      scaleY: 1
    };
    if (unit === activeUnit) {
      const overRect = unitRects[overUnit];
      if (!overRect) return null;
      return {
        ...transform,
        y: activeUnit < overUnit ? overRect.top + overRect.height - (activeRect.top + activeRect.height) : overRect.top - activeRect.top
      };
    }
    const gap = getUnitGap(unitRects, unit, activeUnit);
    if (unit > activeUnit && unit <= overUnit) {
      return {
        ...transform,
        y: -activeRect.height - gap
      };
    }
    if (unit < activeUnit && unit >= overUnit) {
      return {
        ...transform,
        y: activeRect.height + gap
      };
    }
    return {
      ...transform,
      y: 0
    };
  };
}
function closestUnitCenter(units) {
  return ({
    collisionRect,
    droppableRects,
    droppableContainers
  }) => {
    const centerY = collisionRect.top + collisionRect.height / 2;
    const centerX = collisionRect.left + collisionRect.width / 2;
    const containerById = new Map(droppableContainers.map((container) => [container.id, container]));
    const collisions = [];
    for (const unit of units) {
      const droppableContainer = containerById.get(unit.key);
      if (!droppableContainer) continue;
      const rect = unionRect(unit.ids.map((id) => droppableRects.get(id)));
      if (!rect) continue;
      const dx = rect.left + rect.width / 2 - centerX;
      const dy = rect.top + rect.height / 2 - centerY;
      collisions.push({
        id: unit.key,
        data: {
          droppableContainer,
          value: Math.hypot(dx, dy)
        }
      });
    }
    return collisions.sort((a, b) => a.data.value - b.data.value);
  };
}
const WS = "ws::";
const SEC = "sec::";
const DROP_ZONE = "dropzone::";
const wsId = (id) => `${WS}${id}`;
const secId = (id) => `${SEC}${id}`;
const isSec = (id) => String(id).startsWith(SEC);
const parseId = (id) => {
  const s = String(id);
  if (s.startsWith(WS)) return {
    type: "workspace",
    realId: s.slice(WS.length)
  };
  if (s.startsWith(SEC)) return {
    type: "section",
    realId: s.slice(SEC.length)
  };
  return null;
};
const workspaceIdsOf = (ids) => new Set(ids.flatMap((id) => {
  const parsed = parseId(id);
  return parsed?.type === "workspace" ? [parsed.realId] : [];
}));
const PINNED_CONTAINER = "pinned";
const SESSIONS_CONTAINER = "sessions";
const dropZoneId = (container) => `${DROP_ZONE}${container}`;
const parseDropZoneId = (id) => {
  const s = String(id);
  return s.startsWith(DROP_ZONE) ? s.slice(DROP_ZONE.length) : null;
};
function buildContainerMap(items) {
  const map = new Map();
  for (const id of items.pinned) map.set(id, PINNED_CONTAINER);
  for (const id of items.sessions) map.set(id, SESSIONS_CONTAINER);
  for (const [projectId, list] of Object.entries(items.byProject)) {
    for (const id of list) map.set(id, projectId);
  }
  return map;
}
function getContainerList(items, container) {
  if (container === PINNED_CONTAINER) return items.pinned;
  if (container === SESSIONS_CONTAINER) return items.sessions;
  return items.byProject[container] ?? [];
}
function withContainerList(items, container, list) {
  if (container === PINNED_CONTAINER) return {
    ...items,
    pinned: list
  };
  if (container === SESSIONS_CONTAINER) return {
    ...items,
    sessions: list
  };
  return {
    ...items,
    byProject: {
      ...items.byProject,
      [container]: list
    }
  };
}
const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always
  }
};
function buildFlatItems(children) {
  const items = [];
  for (const child of children) {
    if (child.type === "workspace") {
      items.push(wsId(child.workspace.id));
    } else {
      items.push(secId(child.section.id));
      for (const ws of child.section.workspaces) {
        items.push(wsId(ws.id));
      }
    }
  }
  return items;
}
function collectMembership(children, into) {
  for (const child of children) {
    if (child.type !== "section") continue;
    for (const ws of child.section.workspaces) {
      into[wsId(ws.id)] = secId(child.section.id);
    }
  }
}
function buildMembership(projects, sessionChildren) {
  const membership = {};
  for (const project of projects) {
    collectMembership(project.children, membership);
  }
  collectMembership(sessionChildren, membership);
  return membership;
}
function fingerprintChildren(children) {
  return children.map((c) => c.type === "workspace" ? c.workspace.id : `s:${c.section.id}:${c.section.workspaces.map((w) => w.id).join("|")}`).join(",");
}
function hasInFlightRowWrite(transactions, dropWriteIds) {
  for (const workspaceId of dropWriteIds) {
    if (transactions[workspaceId]?.type === "update") return true;
  }
  return false;
}
function planExternalSync(input) {
  if (input.inFlight) return "hold";
  if (input.wasHeld || input.fingerprint !== input.prevFingerprint) {
    return "sync";
  }
  return "skip";
}
function membershipFromNeighbors(list, membership, id) {
  const index = list.indexOf(id);
  if (index <= 0) return null;
  const above = list[index - 1];
  if (isSec(above)) return String(above);
  return membership[String(above)] ?? null;
}
function parseFlatItems(items, membership) {
  const result = {
    topLevel: [],
    sections: {}
  };
  for (const id of items) {
    const parsed = parseId(id);
    if (!parsed) continue;
    if (parsed.type === "section") {
      result.topLevel.push({
        type: "section",
        id: parsed.realId
      });
      result.sections[parsed.realId] ??= [];
    } else if (parsed.type === "workspace") {
      const sectionFlatId = membership[String(id)];
      const sectionRealId = sectionFlatId ? parseId(sectionFlatId)?.realId : void 0;
      if (sectionRealId && result.sections[sectionRealId]) {
        result.sections[sectionRealId].push(parsed.realId);
      } else {
        result.topLevel.push({
          type: "workspace",
          id: parsed.realId
        });
      }
    }
  }
  return result;
}
const DashboardSidebarDndContext = reactExports.createContext(null);
const SidebarDndContextProvider = DashboardSidebarDndContext.Provider;
function useDashboardSidebarDnd() {
  const value = reactExports.useContext(DashboardSidebarDndContext);
  if (!value) {
    throw new Error("useDashboardSidebarDnd must be used within DashboardSidebarDndProvider");
  }
  return value;
}
function gateSensor(Base) {
  const activators = Base.activators.map(({
    eventName,
    handler
  }) => ({
    eventName,
    handler: (event, options, context) => options.disabled ? false : handler(event, options, context)
  }));
  return class extends Base {
    static activators = activators;
  };
}
const GatedMouseSensor = gateSensor(MouseSensor);
const GatedTouchSensor = gateSensor(TouchSensor);
const GatedKeyboardSensor = gateSensor(KeyboardSensor);
function useSidebarDnd({
  projects,
  pinnedWorkspaces,
  sessionChildren,
  onReorderProjects,
  projectDragDisabled = false,
  childDragDisabled = false
}) {
  const {
    reorderPinnedWorkspaces,
    reorderProjectChildren,
    setSectionWorkspaceOrder,
    setWorkspacePinned
  } = useDashboardSidebarState();
  const noDragsPossible = sdfUseHost() !== null || projectDragDisabled && childDragDisabled;
  const sensorOptions = reactExports.useMemo(() => ({
    mouse: {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX
      },
      disabled: noDragsPossible
    },
    touch: {
      activationConstraint: {
        delay: 200,
        tolerance: 5
      },
      disabled: noDragsPossible
    },
    keyboard: {
      coordinateGetter: sortableKeyboardCoordinates,
      disabled: noDragsPossible
    }
  }), [noDragsPossible]);
  const sensors = useSensors(useSensor(GatedMouseSensor, sensorOptions.mouse), useSensor(GatedTouchSensor, sensorOptions.touch), useSensor(GatedKeyboardSensor, sensorOptions.keyboard));
  const [items, setItems] = reactExports.useState(() => ({
    pinned: pinnedWorkspaces.map((ws) => wsId(ws.id)),
    sessions: buildFlatItems(sessionChildren),
    byProject: Object.fromEntries(projects.map((project) => [project.id, buildFlatItems(project.children)])),
    membership: buildMembership(projects, sessionChildren)
  }));
  const itemsRef = reactExports.useRef(items);
  const containerByIdRef = reactExports.useRef(buildContainerMap(items));
  const commitDragItems = reactExports.useCallback((next) => {
    itemsRef.current = next;
    containerByIdRef.current = buildContainerMap(next);
    setItems(next);
  }, []);
  const containerById = reactExports.useMemo(() => buildContainerMap(items), [items]);
  const [activeId, setActiveId] = reactExports.useState(null);
  const activeIdRef = reactExports.useRef(null);
  const [overId, setOverId] = reactExports.useState(null);
  const clonedRef = reactExports.useRef(null);
  const projectIds = reactExports.useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const typeOf = reactExports.useCallback((id) => {
    const s = String(id);
    if (s.startsWith(WS)) return "workspace";
    if (s.startsWith(SEC)) return "section";
    if (projectIds.has(s)) return "project";
    return null;
  }, [projectIds]);
  const activeType = activeId ? typeOf(activeId) : null;
  const prevFingerprintRef = reactExports.useRef("");
  const dropWriteIdsRef = reactExports.useRef(new Set());
  const heldRef = reactExports.useRef(false);
  const workspaceTransactionsById = useWorkspaceTransactionsStore((state) => state.byWorkspaceId);
  reactExports.useEffect(() => {
    if (activeId || activeIdRef.current) return;
    const fingerprint = [pinnedWorkspaces.map((ws) => ws.id).join("|"), fingerprintChildren(sessionChildren), projects.map((project) => `${project.id}:${fingerprintChildren(project.children)}`).join(";")].join("\n");
    const plan = planExternalSync({
      inFlight: hasInFlightRowWrite(workspaceTransactionsById, dropWriteIdsRef.current),
      wasHeld: heldRef.current,
      fingerprint,
      prevFingerprint: prevFingerprintRef.current
    });
    if (plan === "hold") {
      heldRef.current = true;
      return;
    }
    dropWriteIdsRef.current = new Set();
    heldRef.current = false;
    if (plan === "sync") {
      prevFingerprintRef.current = fingerprint;
      commitDragItems({
        pinned: pinnedWorkspaces.map((ws) => wsId(ws.id)),
        sessions: buildFlatItems(sessionChildren),
        byProject: Object.fromEntries(projects.map((project) => [project.id, buildFlatItems(project.children)])),
        membership: buildMembership(projects, sessionChildren)
      });
    }
  }, [projects, pinnedWorkspaces, sessionChildren, activeId, commitDragItems, workspaceTransactionsById]);
  const workspacesById = reactExports.useMemo(() => {
    const map = new Map();
    for (const ws of pinnedWorkspaces) map.set(ws.id, ws);
    const collect = (children) => {
      for (const child of children) {
        if (child.type === "workspace") {
          map.set(child.workspace.id, child.workspace);
        } else {
          for (const ws of child.section.workspaces) {
            map.set(ws.id, ws);
          }
        }
      }
    };
    collect(sessionChildren);
    for (const project of projects) collect(project.children);
    return map;
  }, [projects, pinnedWorkspaces, sessionChildren]);
  const sectionsById = reactExports.useMemo(() => {
    const map = new Map();
    const collect = (children) => {
      for (const child of children) {
        if (child.type === "section") map.set(child.section.id, child.section);
      }
    };
    collect(sessionChildren);
    for (const project of projects) collect(project.children);
    return map;
  }, [projects, sessionChildren]);
  const projectsById = reactExports.useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const collapsedSectionIds = reactExports.useMemo(() => {
    const set = new Set();
    for (const section of sectionsById.values()) {
      if (section.isCollapsed) set.add(section.id);
    }
    return set;
  }, [sectionsById]);
  const groupInfo = reactExports.useMemo(() => {
    const map = new Map();
    for (const [wsFlatId, secFlatId] of Object.entries(items.membership)) {
      const wsParsed = parseId(wsFlatId);
      const secParsed = parseId(secFlatId);
      if (!wsParsed || !secParsed) continue;
      const sec = sectionsById.get(secParsed.realId);
      if (!sec) continue;
      map.set(wsParsed.realId, {
        sectionId: sec.id,
        color: sec.color
      });
    }
    return map;
  }, [items.membership, sectionsById]);
  const activeContainer = activeId ? containerById.get(activeId) ?? null : null;
  const activeSectionId = reactExports.useMemo(() => {
    if (!activeId || activeType !== "section") return null;
    return parseId(activeId)?.realId ?? null;
  }, [activeId, activeType]);
  const activeWorkspaceHome = reactExports.useMemo(() => {
    if (!activeId || activeType !== "workspace") return null;
    const parsed = parseId(activeId);
    if (!parsed) return null;
    const ws = workspacesById.get(parsed.realId);
    if (!ws) return null;
    return ws.projectId ?? SESSIONS_CONTAINER;
  }, [activeId, activeType, workspacesById]);
  const activeItem = reactExports.useMemo(() => {
    if (!activeId) return null;
    if (activeType === "project") {
      const project = projectsById.get(String(activeId));
      return project ? {
        type: "project",
        project
      } : null;
    }
    const parsed = parseId(activeId);
    if (!parsed) return null;
    if (parsed.type === "workspace") {
      const ws = workspacesById.get(parsed.realId);
      return ws ? {
        type: "workspace",
        workspace: ws
      } : null;
    }
    const sec = sectionsById.get(parsed.realId);
    return sec ? {
      type: "section",
      section: sec
    } : null;
  }, [activeId, activeType, projectsById, workspacesById, sectionsById]);
  const predictedColor = reactExports.useMemo(() => {
    if (!activeId || !overId || activeType !== "workspace") return null;
    if (!activeContainer || activeContainer === PINNED_CONTAINER) return null;
    const list = getContainerList(items, activeContainer);
    const oldIndex = list.indexOf(activeId);
    const overIndex = list.indexOf(overId);
    if (oldIndex === -1 || overIndex === -1) return null;
    const moved = oldIndex === overIndex ? list : arrayMove(list, oldIndex, overIndex);
    const sectionFlatId = membershipFromNeighbors(moved, items.membership, activeId);
    if (!sectionFlatId) return null;
    const parsed = parseId(sectionFlatId);
    const sec = parsed ? sectionsById.get(parsed.realId) : void 0;
    return sec?.color ?? null;
  }, [activeId, overId, activeType, activeContainer, items, sectionsById]);
  const getContainerSortingStrategy = reactExports.useCallback((containerId) => {
    if (activeType === "section" && activeContainer === containerId) {
      return createSectionUnitSortingStrategy(getContainerList(items, containerId), items.membership, isSec);
    }
    return verticalListSortingStrategy;
  }, [items, activeType, activeContainer]);
  const lastOverIdRef = reactExports.useRef(null);
  const recentlyMovedToNewContainerRef = reactExports.useRef(false);
  const freezeCollisionsForOneFrame = reactExports.useCallback(() => {
    recentlyMovedToNewContainerRef.current = true;
    requestAnimationFrame(() => {
      recentlyMovedToNewContainerRef.current = false;
    });
  }, []);
  const collisionDetection = reactExports.useCallback((args) => {
    const type = typeOf(args.active.id);
    if (type === "project") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => projectIds.has(String(container.id)))
      });
    }
    if (type === "section") {
      const current = itemsRef.current;
      const container = containerByIdRef.current.get(args.active.id);
      if (!container) return [];
      const units = buildTopLevelUnits(getContainerList(current, container), current.membership, isSec);
      return closestUnitCenter(units)(args);
    }
    if (type === "workspace") {
      if (recentlyMovedToNewContainerRef.current) {
        lastOverIdRef.current = args.active.id;
        return [{
          id: args.active.id
        }];
      }
      const parsed = parseId(args.active.id);
      const ws = parsed ? workspacesById.get(parsed.realId) : null;
      const home = ws ? ws.projectId ?? SESSIONS_CONTAINER : null;
      const droppableContainers = args.droppableContainers.filter((candidate) => {
        const container = parseDropZoneId(candidate.id) ?? containerByIdRef.current.get(candidate.id);
        return container === PINNED_CONTAINER || container === home;
      });
      const pointerCollisions = pointerWithin({
        ...args,
        droppableContainers
      });
      const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection({
        ...args,
        droppableContainers
      });
      const overId2 = getFirstCollision(collisions, "id");
      if (overId2 != null) {
        lastOverIdRef.current = overId2;
        return collisions;
      }
      return lastOverIdRef.current ? [{
        id: lastOverIdRef.current
      }] : [];
    }
    return closestCenter(args);
  }, [typeOf, projectIds, workspacesById]);
  const commitContainerToDb = reactExports.useCallback((container, list, membership) => {
    const projectId = laneProjectIdForScope(container);
    const parsed = parseFlatItems(list, membership);
    reorderProjectChildren(projectId, parsed.topLevel);
    for (const [sectionId, wsIds] of Object.entries(parsed.sections)) {
      setSectionWorkspaceOrder(projectId, sectionId, wsIds);
    }
  }, [reorderProjectChildren, setSectionWorkspaceOrder]);
  const persistWorkspaceDrop = reactExports.useCallback((workspaceId, container, containerList, membership) => {
    const ws = workspacesById.get(workspaceId);
    if (container === PINNED_CONTAINER) {
      reorderPinnedWorkspaces(
        containerList.flatMap((id) => {
          const parsed = parseId(id);
          if (parsed?.type !== "workspace") return [];
          return [{
            workspaceId: parsed.realId,
            projectId: workspacesById.get(parsed.realId)?.projectId ?? null
          }];
        }),
        {
          allowNewWorkspaceId: workspaceId
        }
      );
      return;
    }
    if (ws?.isPinned) {
      setWorkspacePinned(workspaceId, ws.projectId, false);
    }
    commitContainerToDb(container, containerList, membership);
  }, [workspacesById, reorderPinnedWorkspaces, setWorkspacePinned, commitContainerToDb]);
  const onDragStart = reactExports.useCallback(({
    active
  }) => {
    activeIdRef.current = active.id;
    lastOverIdRef.current = null;
    recentlyMovedToNewContainerRef.current = false;
    setActiveId(active.id);
    clonedRef.current = itemsRef.current;
  }, []);
  const onDragOver = reactExports.useCallback(({
    active,
    over
  }) => {
    setOverId(over?.id ?? null);
    if (!over || typeOf(active.id) !== "workspace") return;
    const current = itemsRef.current;
    const sourceContainer = containerByIdRef.current.get(active.id);
    const targetContainer = parseDropZoneId(over.id) ?? containerByIdRef.current.get(over.id);
    if (!sourceContainer || !targetContainer || sourceContainer === targetContainer) {
      return;
    }
    const source = getContainerList(current, sourceContainer).filter((id) => id !== active.id);
    const target = [...getContainerList(current, targetContainer)];
    if (target.includes(active.id)) return;
    const overIndex = target.indexOf(over.id);
    let newIndex;
    if (overIndex === -1) {
      newIndex = target.length;
    } else {
      const isBelowOverItem = active.rect.current.translated != null && active.rect.current.translated.top > over.rect.top + over.rect.height;
      newIndex = overIndex + (isBelowOverItem ? 1 : 0);
    }
    target.splice(newIndex, 0, active.id);
    freezeCollisionsForOneFrame();
    const next = withContainerList(withContainerList(current, sourceContainer, source), targetContainer, target);
    const membership = {
      ...next.membership
    };
    const sectionFlatId = targetContainer !== PINNED_CONTAINER ? membershipFromNeighbors(target, membership, active.id) : null;
    if (sectionFlatId) {
      membership[String(active.id)] = sectionFlatId;
    } else {
      delete membership[String(active.id)];
    }
    commitDragItems({
      ...next,
      membership
    });
  }, [typeOf, commitDragItems, freezeCollisionsForOneFrame]);
  const onDragEnd = reactExports.useCallback(({
    active,
    over
  }) => {
    const type = typeOf(active.id);
    const snapshot = clonedRef.current;
    clonedRef.current = null;
    activeIdRef.current = null;
    setActiveId(null);
    setOverId(null);
    const revert = () => {
      if (snapshot) commitDragItems(snapshot);
    };
    if (!over) {
      revert();
      return;
    }
    if (type === "project") {
      if (active.id !== over.id && projectIds.has(String(over.id))) {
        const order = projects.map((project) => project.id);
        const oldIndex = order.indexOf(String(active.id));
        const newIndex = order.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderProjects(arrayMove(order, oldIndex, newIndex));
        }
      }
      return;
    }
    const current = itemsRef.current;
    if (type === "section") {
      const container = containerByIdRef.current.get(active.id);
      if (!container || container === PINNED_CONTAINER || active.id === over.id) {
        return;
      }
      const list = getContainerList(current, container);
      const units = buildTopLevelUnits(list, current.membership, isSec);
      const oldIdx = findUnitIndex(units, active.id);
      const newIdx = findUnitIndex(units, over.id);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const rebuilt = arrayMove(units, oldIdx, newIdx).flatMap((unit) => unit.ids);
      const newList = rebuilt;
      commitDragItems(withContainerList(current, container, newList));
      dropWriteIdsRef.current = workspaceIdsOf(newList);
      commitContainerToDb(container, newList, current.membership);
      return;
    }
    if (type === "workspace") {
      const parsed = parseId(active.id);
      const sourceContainer = containerByIdRef.current.get(active.id);
      const targetContainer = parseDropZoneId(over.id) ?? containerByIdRef.current.get(over.id) ?? sourceContainer;
      if (!parsed || !sourceContainer || !targetContainer) {
        revert();
        return;
      }
      let targetList;
      let next = current;
      if (sourceContainer !== targetContainer) {
        const source = getContainerList(current, sourceContainer).filter((id) => id !== active.id);
        targetList = [...getContainerList(current, targetContainer)];
        const overIndex = targetList.indexOf(over.id);
        targetList.splice(overIndex === -1 ? targetList.length : overIndex, 0, active.id);
        next = withContainerList(next, sourceContainer, source);
      } else {
        targetList = getContainerList(current, targetContainer);
        const oldIndex = targetList.indexOf(active.id);
        const overIndex = targetList.indexOf(over.id);
        if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
          targetList = arrayMove(targetList, oldIndex, overIndex);
        }
      }
      const startList = snapshot ? getContainerList(snapshot, targetContainer) : null;
      const unchanged = startList != null && startList.length === targetList.length && startList.every((id, index) => id === targetList[index]);
      const membership = {
        ...next.membership
      };
      if (unchanged) {
        const snapshotSection = snapshot?.membership[String(active.id)];
        if (snapshotSection) {
          membership[String(active.id)] = snapshotSection;
        } else {
          delete membership[String(active.id)];
        }
      } else {
        const sectionFlatId = targetContainer !== PINNED_CONTAINER ? membershipFromNeighbors(targetList, membership, active.id) : null;
        if (sectionFlatId) {
          membership[String(active.id)] = sectionFlatId;
        } else {
          delete membership[String(active.id)];
        }
      }
      commitDragItems({
        ...withContainerList(next, targetContainer, targetList),
        membership
      });
      if (!unchanged) {
        dropWriteIdsRef.current = workspaceIdsOf([...targetList, ...getContainerList(next, sourceContainer)]);
        persistWorkspaceDrop(parsed.realId, targetContainer, targetList, membership);
      }
    }
  }, [typeOf, projects, projectIds, onReorderProjects, commitContainerToDb, persistWorkspaceDrop, commitDragItems]);
  const onDragCancel = reactExports.useCallback(() => {
    const swallowClick = (event) => {
      event.stopPropagation();
      disarm();
    };
    const onMouseUp = () => {
      setTimeout(disarm, 50);
    };
    const disarm = () => {
      document.removeEventListener("click", swallowClick, {
        capture: true
      });
      document.removeEventListener("mouseup", onMouseUp, {
        capture: true
      });
    };
    document.addEventListener("click", swallowClick, {
      capture: true
    });
    document.addEventListener("mouseup", onMouseUp, {
      capture: true
    });
    if (clonedRef.current) {
      commitDragItems(clonedRef.current);
    }
    activeIdRef.current = null;
    setActiveId(null);
    setOverId(null);
    clonedRef.current = null;
  }, [commitDragItems]);
  const contextValue = reactExports.useMemo(() => ({
    pinnedItems: items.pinned,
    sessionItems: items.sessions,
    projectItems: items.byProject,
    getContainerSortingStrategy,
    activeId,
    activeType,
    activeContainer,
    activeSectionId,
    activeWorkspaceHome,
    workspacesById,
    sectionsById,
    projectsById,
    groupInfo,
    collapsedSectionIds,
    isChildDragDisabled: childDragDisabled
  }), [items, getContainerSortingStrategy, activeId, activeType, activeContainer, activeSectionId, activeWorkspaceHome, workspacesById, sectionsById, projectsById, groupInfo, collapsedSectionIds, childDragDisabled]);
  return {
    sensors,
    measuring,
    collisionDetection,
    activeItem,
    predictedColor,
    contextValue,
    handlers: {
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel
    }
  };
}
                   