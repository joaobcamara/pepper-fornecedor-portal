export function buildFoundationAutomatedStockObservation(input: {
  reason: string;
  reference: string;
  origin?: string;
  flow?: string;
}) {
  const origin = (input.origin ?? "Pepper IA").trim();
  const flow = (input.flow ?? "Grupo Pepper").trim();
  const reason = input.reason.trim();
  const reference = input.reference.trim();

  return `Origem: ${origin} | Motivo: ${reason} | Fluxo: ${flow} | Referencia: ${reference}`;
}
