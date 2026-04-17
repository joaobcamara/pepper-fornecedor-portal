type FoundationMetadataRecord = Record<string, unknown> & {
  portalCatalogView?: unknown;
};

export type PortalCatalogViewState = {
  visible: boolean;
  archivedAt: string | null;
  hiddenReason: string | null;
  managedByPortal: boolean;
};

const DEFAULT_PORTAL_CATALOG_VIEW_STATE: PortalCatalogViewState = {
  visible: true,
  archivedAt: null,
  hiddenReason: null,
  managedByPortal: true
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFoundationMetadataJson(input: string | null | undefined): FoundationMetadataRecord {
  if (!input) {
    return {};
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return isRecord(parsed) ? (parsed as FoundationMetadataRecord) : {};
  } catch {
    return {};
  }
}

export function readPortalCatalogViewState(input: string | null | undefined): PortalCatalogViewState {
  const metadata = parseFoundationMetadataJson(input);
  const portalCatalogView = metadata.portalCatalogView;

  if (!isRecord(portalCatalogView)) {
    return DEFAULT_PORTAL_CATALOG_VIEW_STATE;
  }

  return {
    visible:
      typeof portalCatalogView.visible === "boolean"
        ? portalCatalogView.visible
        : DEFAULT_PORTAL_CATALOG_VIEW_STATE.visible,
    archivedAt:
      typeof portalCatalogView.archivedAt === "string" ? portalCatalogView.archivedAt : DEFAULT_PORTAL_CATALOG_VIEW_STATE.archivedAt,
    hiddenReason:
      typeof portalCatalogView.hiddenReason === "string"
        ? portalCatalogView.hiddenReason
        : DEFAULT_PORTAL_CATALOG_VIEW_STATE.hiddenReason,
    managedByPortal:
      typeof portalCatalogView.managedByPortal === "boolean"
        ? portalCatalogView.managedByPortal
        : DEFAULT_PORTAL_CATALOG_VIEW_STATE.managedByPortal
  };
}

export function writePortalCatalogViewState(params: {
  currentFoundationMetadataJson?: string | null;
  visible: boolean;
  hiddenReason?: string | null;
  archivedAt?: string | null;
}) {
  const metadata = parseFoundationMetadataJson(params.currentFoundationMetadataJson);

  metadata.portalCatalogView = {
    ...readPortalCatalogViewState(params.currentFoundationMetadataJson),
    visible: params.visible,
    archivedAt: params.visible ? null : params.archivedAt ?? new Date().toISOString(),
    hiddenReason: params.visible ? null : params.hiddenReason ?? "hidden_in_portal",
    managedByPortal: true
  } satisfies PortalCatalogViewState;

  return JSON.stringify(metadata);
}
