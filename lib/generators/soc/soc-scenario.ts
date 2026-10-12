import type { Generator } from "../index";

export const socScenario: Generator = (rng, params) => {
  const scenarioId = (params.scenarioId as string) || "soc-l1-noisy-shift";
  const flagToken = `SOC{shift_${rng.hex(8)}}`;

  return {
    env: { kind: "soc", scenarioId },
    answers: {
      flag: flagToken,
      shift_token: flagToken,
      phishing_indicator: "alt-001",
      bastion_indicator: "alt-008",
      scanner_host: "sec-scanner-01.corp.internal",
    },
  };
};
