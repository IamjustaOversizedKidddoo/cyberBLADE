import type { Generator } from "../index";

export const idorLab: Generator = (rng) => {
  const flagProfile = `CYBERBLADE{idor_ciso_${rng.hex(8)}}`;
  const flagInvoice = `CYBERBLADE{idor_inv_${rng.hex(8)}}`;

  return {
    env: {
      kind: "webapp",
      app: {
        appId: "idor_api",
        name: "Vanguard Defense Portal",
        baseUrl: "http://vanguard-portal.internal",
        initialUrl: "http://vanguard-portal.internal/profile",
        database: {},
        config: {
          flags: {
            flag_idor_profile: flagProfile,
            flag_idor_invoice: flagInvoice,
          },
        },
      },
    },
    answers: {
      flag_profile: flagProfile,
      flag_invoice: flagInvoice,
    },
  };
};
