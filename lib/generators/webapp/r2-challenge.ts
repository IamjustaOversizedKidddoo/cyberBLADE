import type { Generator } from "../index";

export const r2Challenge: Generator = (rng) => {
  const flagIdor = `CYBERBLADE{watchtower_idor_${rng.hex(8)}}`;
  const flagSqli = `CYBERBLADE{watchtower_sqli_${rng.hex(8)}}`;
  const flagRoot = `CYBERBLADE{watchtower_root_${rng.hex(8)}}`;

  return {
    env: {
      kind: "webapp",
      app: {
        appId: "r2_capstone",
        name: "Operation Watchtower Master System",
        baseUrl: "http://watchtower.cyberblade.lab",
        initialUrl: "http://watchtower.cyberblade.lab/",
        database: {},
        config: {
          flags: {
            flag_capstone_idor: flagIdor,
            flag_capstone_sqli: flagSqli,
            flag_capstone_root: flagRoot,
          },
        },
      },
    },
    answers: {
      flag_idor: flagIdor,
      flag_sqli: flagSqli,
      flag_root: flagRoot,
    },
  };
};
