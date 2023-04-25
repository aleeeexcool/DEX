const { deployContract, contractAt, sendTxn, getFrameSigner } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

const { AddressZero } = ethers.constants

async function getArbValues() {
  const { nativeToken } = tokens
  const zlp = { address: "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258" }
  const feeZlpTracker = { address: "0x4e971a87900b931fF39d1Aad67697F49835400b6" }
  const stakedZlpTracker = { address: "0x1aDDD80E6039594eE970E5872D247bf0414C8903" }
  const zlpManager = { address: "0x3963FfC9dff443c2A94f21b129D429891E32ec18" }

  return { nativeToken, zlp, feeZlpTracker, stakedZlpTracker, zlpManager }
}

async function getAvaxValues() {
  const { nativeToken } = tokens
  const zlp = { address: "0x01234181085565ed162a948b6a5e88758CD7c7b8" }
  const feeZlpTracker = { address: "0xd2D1162512F927a7e282Ef43a362659E4F2a728F" }
  const stakedZlpTracker = { address: "0x9e295B5B976a184B14aD8cd72413aD846C299660" }
  const zlpManager = { address: "0xD152c7F25db7F4B95b7658323c5F33d176818EE4" }

  return { nativeToken, zlp, feeZlpTracker, stakedZlpTracker, zlpManager }
}

async function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }
}

async function main() {
  const { nativeToken, zlp, feeZlpTracker, stakedZlpTracker, zlpManager } = await getValues()

  const rewardRouter = await deployContract("RewardRouterV2", [])
  await sendTxn(rewardRouter.initialize(
    nativeToken.address, // _weth
    AddressZero, // _zke
    AddressZero, // _esZke
    AddressZero, // _bnZke
    zlp.address, // _zlp
    AddressZero, // _stakedZkeTracker
    AddressZero, // _bonusZkeTracker
    AddressZero, // _feeZkeTracker
    feeZlpTracker.address, // _feeZlpTracker
    stakedZlpTracker.address, // _stakedZlpTracker
    zlpManager.address, // _zlpManager
    AddressZero, // _zkeVester
    AddressZero // zlpVester
  ), "rewardRouter.initialize")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
