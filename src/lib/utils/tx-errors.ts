type TxErrorLike = {
  name?: string;
  message?: string;
  shortMessage?: string;
  cause?: {
    message?: string;
    shortMessage?: string;
  };
};

const getErrorText = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const err = error as TxErrorLike;
  return [
    err.name,
    err.shortMessage,
    err.message,
    err.cause?.shortMessage,
    err.cause?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const getFriendlyTxErrorMessage = (
  error: unknown,
  actionLabel = "Transaction"
) => {
  const text = getErrorText(error);
  if (
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("rejected request") ||
    text.includes("denied request") ||
    text.includes("rejected") ||
    text.includes("denied") ||
    text.includes("canceled") ||
    text.includes("cancelled")
  ) {
    return `${actionLabel} canceled.`;
  }
  if (text.includes("insufficient funds")) {
    return "Insufficient funds for gas.";
  }
  if (text.includes("notwhitelisted") || text.includes("not whitelisted")) {
    return "This wallet is not on the whitelist for the current mint phase.";
  }
  if (text.includes("salenotstarted") || text.includes("sale not started")) {
    return "Minting has not started yet.";
  }
  if (text.includes("saleended") || text.includes("sale ended")) {
    return "This mint window has ended.";
  }
  if (text.includes("walletlimitreached") || text.includes("wallet limit")) {
    return "This wallet has reached the mint limit for the collection.";
  }
  if (text.includes("soldout") || text.includes("sold out")) {
    return "This collection is sold out.";
  }
  if (text.includes("whitelistupdateslocked") || text.includes("whitelist updates locked")) {
    return "Whitelist edits are locked because the whitelist phase has already started.";
  }
  if (text.includes("invalidconfig") || text.includes("invalid config")) {
    return "The sale configuration is invalid. Check your prices and dates.";
  }
  return `${actionLabel} failed. Please try again.`;
};
