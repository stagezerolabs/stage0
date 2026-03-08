import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Presale } from '../generated/schema';
import { LaunchpadPresale } from '../generated/templates/PresaleContract/LaunchpadPresale';
import { ERC20Metadata } from '../generated/templates/PresaleContract/ERC20Metadata';
import { ZERO_ADDRESS } from './common';

const ZERO_BI = BigInt.zero();
const NATIVE_SYMBOL = 'ETH';
const NATIVE_NAME = 'Native';
const NATIVE_DECIMALS = 18;

function setErc20Metadata(entity: Presale, isSaleToken: bool, tokenAddress: Address): void {
  const token = ERC20Metadata.bind(tokenAddress);

  const symbolResult = token.try_symbol();
  if (!symbolResult.reverted) {
    if (isSaleToken) {
      entity.saleTokenSymbol = symbolResult.value;
    } else {
      entity.paymentTokenSymbol = symbolResult.value;
    }
  }

  const nameResult = token.try_name();
  if (!nameResult.reverted) {
    if (isSaleToken) {
      entity.saleTokenName = nameResult.value;
    } else {
      entity.paymentTokenName = nameResult.value;
    }
  }

  const decimalsResult = token.try_decimals();
  if (!decimalsResult.reverted) {
    if (isSaleToken) {
      entity.saleTokenDecimals = decimalsResult.value;
    } else {
      entity.paymentTokenDecimals = decimalsResult.value;
    }
  }
}

export function loadOrCreatePresale(address: Address, blockNumber: BigInt, timestamp: BigInt): Presale {
  const id = address.toHexString().toLowerCase();
  let entity = Presale.load(id);

  if (entity == null) {
    entity = new Presale(id);
    entity.address = address;
    entity.creator = ZERO_ADDRESS;
    entity.saleToken = ZERO_ADDRESS;
    entity.paymentToken = ZERO_ADDRESS;
    entity.isPaymentETH = false;
    entity.requiresWhitelist = false;
    entity.startTime = ZERO_BI;
    entity.endTime = ZERO_BI;
    entity.rate = ZERO_BI;
    entity.softCap = ZERO_BI;
    entity.hardCap = ZERO_BI;
    entity.minContribution = ZERO_BI;
    entity.maxContribution = ZERO_BI;
    entity.totalRaised = ZERO_BI;
    entity.committedTokens = ZERO_BI;
    entity.totalTokensDeposited = ZERO_BI;
    entity.successfulFinalization = false;
    entity.claimEnabled = false;
    entity.refundsEnabled = false;
    entity.owner = ZERO_ADDRESS;
    entity.createdAtBlock = blockNumber;
    entity.createdAtTimestamp = timestamp;
  }

  entity.updatedAtBlock = blockNumber;
  entity.updatedAtTimestamp = timestamp;

  return entity as Presale;
}

export function refreshPresale(address: Address, blockNumber: BigInt, timestamp: BigInt): Presale {
  const entity = loadOrCreatePresale(address, blockNumber, timestamp);
  const contract = LaunchpadPresale.bind(address);

  const saleTokenResult = contract.try_saleToken();
  if (!saleTokenResult.reverted) {
    entity.saleToken = saleTokenResult.value;
    if (saleTokenResult.value.notEqual(ZERO_ADDRESS)) {
      setErc20Metadata(entity, true, saleTokenResult.value);
    }
  }

  const paymentTokenResult = contract.try_paymentToken();
  if (!paymentTokenResult.reverted) {
    entity.paymentToken = paymentTokenResult.value;
  }

  const isPaymentEthResult = contract.try_isPaymentETH();
  if (!isPaymentEthResult.reverted) {
    entity.isPaymentETH = isPaymentEthResult.value;
  }

  const startTimeResult = contract.try_startTime();
  if (!startTimeResult.reverted) {
    entity.startTime = startTimeResult.value;
  }

  const endTimeResult = contract.try_endTime();
  if (!endTimeResult.reverted) {
    entity.endTime = endTimeResult.value;
  }

  const rateResult = contract.try_rate();
  if (!rateResult.reverted) {
    entity.rate = rateResult.value;
  }

  const softCapResult = contract.try_softCap();
  if (!softCapResult.reverted) {
    entity.softCap = softCapResult.value;
  }

  const hardCapResult = contract.try_hardCap();
  if (!hardCapResult.reverted) {
    entity.hardCap = hardCapResult.value;
  }

  const minContributionResult = contract.try_minContribution();
  if (!minContributionResult.reverted) {
    entity.minContribution = minContributionResult.value;
  }

  const maxContributionResult = contract.try_maxContribution();
  if (!maxContributionResult.reverted) {
    entity.maxContribution = maxContributionResult.value;
  }

  const totalRaisedResult = contract.try_totalRaised();
  if (!totalRaisedResult.reverted) {
    entity.totalRaised = totalRaisedResult.value;
  }

  const committedTokensResult = contract.try_committedTokens();
  if (!committedTokensResult.reverted) {
    entity.committedTokens = committedTokensResult.value;
  }

  const totalTokensDepositedResult = contract.try_totalTokensDeposited();
  if (!totalTokensDepositedResult.reverted) {
    entity.totalTokensDeposited = totalTokensDepositedResult.value;
  }

  const successfulFinalizationResult = contract.try_successfulFinalization();
  if (!successfulFinalizationResult.reverted) {
    entity.successfulFinalization = successfulFinalizationResult.value;
  }

  const claimEnabledResult = contract.try_claimEnabled();
  if (!claimEnabledResult.reverted) {
    entity.claimEnabled = claimEnabledResult.value;
  }

  const refundsEnabledResult = contract.try_refundsEnabled();
  if (!refundsEnabledResult.reverted) {
    entity.refundsEnabled = refundsEnabledResult.value;
  }

  const ownerResult = contract.try_owner();
  if (!ownerResult.reverted) {
    entity.owner = ownerResult.value;
  }

  if (entity.isPaymentETH) {
    entity.paymentTokenSymbol = NATIVE_SYMBOL;
    entity.paymentTokenName = NATIVE_NAME;
    entity.paymentTokenDecimals = NATIVE_DECIMALS;
  } else if (entity.paymentToken.notEqual(ZERO_ADDRESS)) {
    setErc20Metadata(entity, false, Address.fromBytes(entity.paymentToken));
  }

  return entity;
}
