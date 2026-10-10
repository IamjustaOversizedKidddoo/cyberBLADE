import type { Generator } from "../index";

export const sqliLab: Generator = (rng) => {
  const flagAuth = `CYBERBLADE{sqli_auth_${rng.hex(8)}}`;
  const flagUnion = `CYBERBLADE{sqli_union_${rng.hex(8)}}`;
  const adminToken = `token_adm_${rng.hex(12)}`;

  return {
    env: {
      kind: "webapp",
      app: {
        appId: "sqli_portal",
        name: "Apex Vault Core",
        baseUrl: "http://apex-vault.internal",
        initialUrl: "http://apex-vault.internal/login",
        database: {},
        config: {
          adminToken,
          flags: {
            flag_auth_bypass: flagAuth,
            flag_union_extract: flagUnion,
          },
        },
      },
    },
    answers: {
      flag_auth: flagAuth,
      flag_union: flagUnion,
    },
  };
};
