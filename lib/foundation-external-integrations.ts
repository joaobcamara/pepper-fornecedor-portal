export type FoundationExternalIntegrationKey =
  | "printnode"
  | "sendpulse"
  | "melhor-envio"
  | "mercado-pago"
  | "mercado-livre"
  | "shopee-br"
  | "tiktok-shop"
  | "magalu-seller";

export type FoundationExternalIntegrationStatus =
  | "READY_CREDENTIALS"
  | "PARTIAL_CREDENTIALS"
  | "PENDING_CREDENTIALS";

export type FoundationExternalIntegration = {
  key: FoundationExternalIntegrationKey;
  label: string;
  domain: "printing" | "communication" | "marketplace" | "shipping" | "payments";
  envKeys: string[];
  status: FoundationExternalIntegrationStatus;
};

export const FOUNDATION_EXTERNAL_INTEGRATIONS: FoundationExternalIntegration[] = [
  {
    key: "printnode",
    label: "PrintNode",
    domain: "printing",
    envKeys: ["PRINTNODE_API_KEY"],
    status: "READY_CREDENTIALS"
  },
  {
    key: "sendpulse",
    label: "SendPulse",
    domain: "communication",
    envKeys: ["SENDPULSE_CLIENT_ID", "SENDPULSE_API_KEY"],
    status: "READY_CREDENTIALS"
  },
  {
    key: "melhor-envio",
    label: "Melhor Envio",
    domain: "shipping",
    envKeys: [
      "MELHOR_ENVIO_CLIENT_ID",
      "MELHOR_ENVIO_CLIENT_SECRET",
      "MELHOR_ENVIO_REDIRECT_URI",
      "MELHOR_ENVIO_ACCESS_TOKEN",
      "MELHOR_ENVIO_REFRESH_TOKEN"
    ],
    status: "PENDING_CREDENTIALS"
  },
  {
    key: "mercado-pago",
    label: "Mercado Pago",
    domain: "payments",
    envKeys: ["MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_PUBLIC_KEY", "MERCADO_PAGO_WEBHOOK_SECRET"],
    status: "PENDING_CREDENTIALS"
  },
  {
    key: "mercado-livre",
    label: "Mercado Livre",
    domain: "marketplace",
    envKeys: ["MERCADO_LIVRE_CLIENT_ID", "MERCADO_LIVRE_CLIENT_SECRET", "MERCADO_LIVRE_REDIRECT_URI"],
    status: "PARTIAL_CREDENTIALS"
  },
  {
    key: "shopee-br",
    label: "Shopee Brasil",
    domain: "marketplace",
    envKeys: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID"],
    status: "PENDING_CREDENTIALS"
  },
  {
    key: "tiktok-shop",
    label: "TikTok Shop",
    domain: "marketplace",
    envKeys: ["TIKTOK_SHOP_APP_KEY", "TIKTOK_SHOP_APP_SECRET", "TIKTOK_SHOP_ID"],
    status: "PENDING_CREDENTIALS"
  },
  {
    key: "magalu-seller",
    label: "Magalu Seller",
    domain: "marketplace",
    envKeys: ["MAGALU_SELLER_CLIENT_ID", "MAGALU_SELLER_CLIENT_SECRET", "MAGALU_SELLER_STORE_ID"],
    status: "PENDING_CREDENTIALS"
  }
];
