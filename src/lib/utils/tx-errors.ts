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
  return `${actionLabel} failed. Please try again.`;
};
