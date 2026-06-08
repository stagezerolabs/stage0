const SENNA_API_URL =
  (import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8788";

export type NFTMetadataValidationResponse = {
  ok: true;
  normalizedBaseURI: string;
  normalizedContractURI: string;
  tokenMetadataUrl: string;
  contractMetadataUrl: string;
  warnings: string[];
};

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

export async function validateNFTMetadata(input: {
  baseURI: string;
  contractURI: string;
}): Promise<NFTMetadataValidationResponse> {
  const response = await fetch(`${SENNA_API_URL}/api/nft/validate-metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as NFTMetadataValidationResponse | { detail?: string } | null;
  if (!response.ok || !payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
    throw new Error(getApiErrorMessage(payload, "Could not validate NFT metadata."));
  }

  return payload;
}

