import type { Generator } from "../index";

export const xssLab: Generator = (rng) => {
  const flagCookie = `CYBERBLADE{xss_stealer_${rng.hex(8)}}`;
  const adminCookie = `adm_session_${rng.hex(12)}`;

  return {
    env: {
      kind: "webapp",
      app: {
        appId: "xss_board",
        name: "Sentinel Operations Feed",
        baseUrl: "http://sentinel-feed.internal",
        initialUrl: "http://sentinel-feed.internal/board",
        database: {},
        config: {
          adminCookie,
          flags: {
            flag_xss_cookie: flagCookie,
          },
        },
      },
    },
    answers: {
      flag_cookie: flagCookie,
      admin_cookie: adminCookie,
    },
  };
};
