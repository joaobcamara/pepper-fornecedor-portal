export type PepperTinyAccountKey = "pepper" | "showlook" | "onshop";
export type PepperTinyAccountRole = "MATRIX" | "DEPENDENT";

export type PepperTinyAccountReferenceItem = {
  key: PepperTinyAccountKey;
  label: string;
  role: PepperTinyAccountRole;
  sortOrder: number;
  active: boolean;
  sharesGroupStock: boolean;
  readsAvailableMultiCompany: boolean;
  handlesCatalogImport: boolean;
  handlesPhysicalStock: boolean;
  zeroBalanceOnCount: boolean;
  salesAffectSharedStock: boolean;
};

export const PEPPER_TINY_ACCOUNT_REFERENCES: PepperTinyAccountReferenceItem[] = [
  {
    key: "pepper",
    label: "Pepper",
    role: "MATRIX",
    sortOrder: 10,
    active: true,
    sharesGroupStock: true,
    readsAvailableMultiCompany: true,
    handlesCatalogImport: true,
    handlesPhysicalStock: true,
    zeroBalanceOnCount: false,
    salesAffectSharedStock: true
  },
  {
    key: "showlook",
    label: "Show Look",
    role: "DEPENDENT",
    sortOrder: 20,
    active: true,
    sharesGroupStock: true,
    readsAvailableMultiCompany: true,
    handlesCatalogImport: false,
    handlesPhysicalStock: false,
    zeroBalanceOnCount: true,
    salesAffectSharedStock: true
  },
  {
    key: "onshop",
    label: "On Shop",
    role: "DEPENDENT",
    sortOrder: 30,
    active: true,
    sharesGroupStock: true,
    readsAvailableMultiCompany: true,
    handlesCatalogImport: false,
    handlesPhysicalStock: false,
    zeroBalanceOnCount: true,
    salesAffectSharedStock: true
  }
];

export function getPepperTinyAccountLabel(accountKey: PepperTinyAccountKey) {
  return (
    PEPPER_TINY_ACCOUNT_REFERENCES.find((item) => item.key === accountKey)?.label ?? accountKey
  );
}

export function getPepperCatalogImportAccountKey(): PepperTinyAccountKey {
  return "pepper";
}

export function getPepperPhysicalStockAccountKey(): PepperTinyAccountKey {
  return "pepper";
}

export function isPepperMatrixAccount(accountKey: PepperTinyAccountKey) {
  return accountKey === "pepper";
}

export function getPepperDependentTinyAccounts() {
  return PEPPER_TINY_ACCOUNT_REFERENCES.filter((item) => item.role === "DEPENDENT");
}

export function shouldReadAvailableMultiCompanyStock(accountKey: PepperTinyAccountKey) {
  return (
    PEPPER_TINY_ACCOUNT_REFERENCES.find((item) => item.key === accountKey)?.readsAvailableMultiCompany ??
    false
  );
}

export function shouldUseTinyAccountForCatalogImport(accountKey: PepperTinyAccountKey) {
  return (
    PEPPER_TINY_ACCOUNT_REFERENCES.find((item) => item.key === accountKey)?.handlesCatalogImport ??
    false
  );
}

export function shouldUseTinyAccountForPhysicalStock(accountKey: PepperTinyAccountKey) {
  return (
    PEPPER_TINY_ACCOUNT_REFERENCES.find((item) => item.key === accountKey)?.handlesPhysicalStock ??
    false
  );
}

export function resolvePepperBalanceTarget(accountKey: PepperTinyAccountKey, realValue: number) {
  return accountKey === "pepper" ? realValue : 0;
}
