import { ChevronDown, Clock3, Coins } from "@/components/ui/icons";
import { InlineLoading } from "@/components/ui/spinner";
import { useId } from "react";
import "./name-listing-form.css";

export type NameListingValues = {
  name: string;
  method: "auction" | "buy-now";
  reserveEth: string;
  durationDays: string;
  fixedPriceEth: string;
};

type NameListingFormProps = {
  names: { node: string; label: string }[];
  value: NameListingValues;
  onChange: (patch: Partial<NameListingValues>) => void;
  ethUsd: number | null;
  isApproved: boolean;
  isApprovalBusy: boolean;
  isSubmitting: boolean;
  onApprove: () => void;
  onSubmit: () => void;
};

export default function NameListingForm({
  names,
  value,
  onChange,
  ethUsd,
  isApproved,
  isApprovalBusy,
  isSubmitting,
  onApprove,
  onSubmit,
}: NameListingFormProps) {
  const id = useId();
  const isAuction = value.method === "auction";
  const priceEth = isAuction ? value.reserveEth : value.fixedPriceEth;
  const numericPrice = Number(priceEth);
  const hasPrice = priceEth.trim() !== "" && Number.isFinite(numericPrice) && numericPrice > 0;
  const usdEstimate = hasPrice && ethUsd !== null && Number.isFinite(ethUsd) && ethUsd > 0
    ? `≈ ${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(numericPrice * ethUsd)}`
    : hasPrice ? "USD estimate unavailable" : "Enter a price";

  return (
    <div className="name-listing-editor">
      <div className="name-listing-fields">
        <div className="name-listing-field">
          <div className="name-listing-label-row">
            <label htmlFor={`${id}-name`}>Name to list</label>
            <span>{names.length} available</span>
          </div>
          <div className="name-listing-select">
            <select
              id={`${id}-name`}
              value={value.name}
              onChange={(event) => onChange({ name: event.target.value })}
            >
              {!value.name && <option value="" disabled>Choose a name</option>}
              {names.map((name) => (
                <option key={name.node} value={name.label}>{name.label}.rise</option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </div>
        </div>

        <fieldset className="name-listing-method-field">
          <legend>Sale method</legend>
          <div className="name-listing-methods">
            <label className="name-listing-method">
              <input
                type="radio"
                name={`${id}-method`}
                value="auction"
                checked={isAuction}
                onChange={() => onChange({ method: "auction" })}
              />
              <span><Clock3 size={17} aria-hidden="true" />Auction</span>
            </label>
            <label className="name-listing-method">
              <input
                type="radio"
                name={`${id}-method`}
                value="buy-now"
                checked={!isAuction}
                onChange={() => onChange({ method: "buy-now" })}
              />
              <span><Coins size={17} aria-hidden="true" />Fixed price</span>
            </label>
          </div>
          <p className="name-listing-hint">
            {isAuction ? "Let buyers compete for your name." : "Let buyers purchase instantly at your price."}
          </p>
        </fieldset>

        <div className={`name-listing-terms ${isAuction ? "is-auction" : ""}`}>
          <div className="name-listing-field">
            <label htmlFor={`${id}-price`}>{isAuction ? "Opening reserve" : "Fixed price"}</label>
            <div className="name-listing-input">
              <input
                id={`${id}-price`}
                aria-label={isAuction ? "Opening reserve in ETH" : "Fixed price in ETH"}
                aria-describedby={`${id}-usd`}
                value={priceEth}
                onChange={(event) => onChange(isAuction
                  ? { reserveEth: event.target.value }
                  : { fixedPriceEth: event.target.value })}
                inputMode="decimal"
                autoComplete="off"
              />
              <span aria-hidden="true">ETH</span>
            </div>
            <p id={`${id}-usd`} className="name-listing-hint name-listing-inline-usd" aria-live="polite">{usdEstimate}</p>
          </div>
          {isAuction && (
            <div className="name-listing-field">
              <label htmlFor={`${id}-duration`}>Duration</label>
              <div className="name-listing-input">
                <input
                  id={`${id}-duration`}
                  aria-label="Auction duration in days"
                  value={value.durationDays}
                  onChange={(event) => onChange({ durationDays: event.target.value })}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <span aria-hidden="true">Days</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="name-listing-preview" aria-label="Listing summary">
        <div className="name-listing-preview-heading">
          <h3>{value.name || "Your name"}<span>.rise</span></h3>
          <p>{isAuction ? "Auction" : "Fixed-price listing"}</p>
        </div>
        <div className="name-listing-price">
          <span>{isAuction ? "Opening reserve" : "Listing price"}</span>
          <strong>{hasPrice ? priceEth : "—"} <small>ETH</small></strong>
          <p>{usdEstimate}</p>
        </div>
        {isAuction && (
          <dl className="name-listing-facts">
            <div><dt>Duration</dt><dd>{value.durationDays || "—"} {Number(value.durationDays) === 1 ? "day" : "days"}</dd></div>
            <div><dt>Minimum bid increase</dt><dd>5%</dd></div>
          </dl>
        )}
        <p className="name-listing-hint name-listing-outcome">
          {isAuction
            ? "The highest valid bid wins when the auction ends."
            : "The first buyer to pay this price gets the name."}
        </p>
        <div className="name-listing-submit">
          {!isApproved ? (
            <button
              type="button"
              onClick={onApprove}
              disabled={isApprovalBusy}
              className="btn-secondary names-action-btn w-full disabled:opacity-60"
            >
              {isApprovalBusy ? <InlineLoading label="Approving..." /> : "Approve marketplace"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !value.name}
              className="btn-primary names-action-btn w-full disabled:opacity-60"
            >
              {isSubmitting
                ? <InlineLoading label={isAuction ? "Creating auction..." : "Creating listing..."} />
                : isAuction ? "Start auction" : "List now"}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
