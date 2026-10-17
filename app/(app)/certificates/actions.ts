"use server";

import { claimCertificateAction as claimAction } from "@/lib/certificates/service";
import type { ClaimCertificateInput } from "@/lib/certificates/types";

export async function claimCertificateAction(input: ClaimCertificateInput) {
  return claimAction(input);
}
