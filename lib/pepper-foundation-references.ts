import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import {
  PEPPER_COLOR_REFERENCES,
  PEPPER_SIZE_REFERENCES,
  type PepperReferenceItem
} from "@/lib/pepper-reference-data";

export type PepperFoundationReferenceSnapshot = {
  sizes: PepperReferenceItem[];
  colors: PepperReferenceItem[];
};

export async function getPepperFoundationReferenceSnapshot(): Promise<PepperFoundationReferenceSnapshot> {
  if (isLocalOperationalMode()) {
    return {
      sizes: PEPPER_SIZE_REFERENCES,
      colors: PEPPER_COLOR_REFERENCES
    };
  }

  try {
    const [sizes, colors] = await Promise.all([
      prisma.pepperSizeReference.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }]
      }),
      prisma.pepperColorReference.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }]
      })
    ]);

    return {
      sizes: sizes.map((item) => ({ code: item.code, label: item.label, sortOrder: item.sortOrder })),
      colors: colors.map((item) => ({ code: item.code, label: item.label, sortOrder: item.sortOrder }))
    };
  } catch {
    return {
      sizes: PEPPER_SIZE_REFERENCES,
      colors: PEPPER_COLOR_REFERENCES
    };
  }
}
