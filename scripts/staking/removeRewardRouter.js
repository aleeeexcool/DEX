const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const rewardRouter = await contractAt("RewardRouter", "0xEa7fCb85802713Cb03291311C66d6012b23402ea")
  const bnZke = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921")
  const zlpManager = await contractAt("ZlpManager", "0x91425Ac4431d068980d497924DD540Ae274f3270")

  const stakedZkeTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusZkeTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeZkeTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  const feeZlpTracker = await contractAt("RewardTracker", "0x4e971a87900b931fF39d1Aad67697F49835400b6")
  const stakedZlpTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")

  // allow rewardRouter to stake in stakedZkeTracker
  await sendTxn(stakedZkeTracker.setHandler(rewardRouter.address, false), "stakedZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in bonusZkeTracker
  await sendTxn(bonusZkeTracker.setHandler(rewardRouter.address, false), "bonusZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeZkeTracker
  await sendTxn(feeZkeTracker.setHandler(rewardRouter.address, false), "feeZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to burn bnZke
  await sendTxn(bnZke.setMinter(rewardRouter.address, false), "bnZke.setMinter(rewardRouter)")

  // allow rewardRouter to mint in zlpManager
  await sendTxn(zlpManager.setHandler(rewardRouter.address, false), "zlpManager.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeZlpTracker
  await sendTxn(feeZlpTracker.setHandler(rewardRouter.address, false), "feeZlpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedZlpTracker
  await sendTxn(stakedZlpTracker.setHandler(rewardRouter.address, false), "stakedZlpTracker.setHandler(rewardRouter)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
