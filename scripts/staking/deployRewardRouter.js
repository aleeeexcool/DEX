const { deployContract, contractAt, sendTxn, readTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

async function main() {
  const {
    nativeToken
  } = tokens

  const weth = await contractAt("Token", nativeToken.address)
  const zke = await contractAt("ZKE", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a")
  const esZke = await contractAt("EsZKE", "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA")
  const bnZke = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921")

  const stakedZkeTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusZkeTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeZkeTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  const feeZlpTracker = await contractAt("RewardTracker", "0x4e971a87900b931fF39d1Aad67697F49835400b6")
  const stakedZlpTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")

  const zlp = await contractAt("ZLP", "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258")
  const zlpManager = await contractAt("ZlpManager", "0x321F653eED006AD1C29D174e17d96351BDe22649")

  console.log("zlpManager", zlpManager.address)

  const rewardRouter = await deployContract("RewardRouter", [])

  await sendTxn(rewardRouter.initialize(
    weth.address,
    zke.address,
    esZke.address,
    bnZke.address,
    zlp.address,
    stakedZkeTracker.address,
    bonusZkeTracker.address,
    feeZkeTracker.address,
    feeZlpTracker.address,
    stakedZlpTracker.address,
    zlpManager.address
  ), "rewardRouter.initialize")

  // allow rewardRouter to stake in stakedZkeTracker
  await sendTxn(stakedZkeTracker.setHandler(rewardRouter.address, true), "stakedZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in bonusZkeTracker
  await sendTxn(bonusZkeTracker.setHandler(rewardRouter.address, true), "bonusZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeZkeTracker
  await sendTxn(feeZkeTracker.setHandler(rewardRouter.address, true), "feeZkeTracker.setHandler(rewardRouter)")
  // allow rewardRouter to burn bnZke
  await sendTxn(bnZke.setMinter(rewardRouter.address, true), "bnZke.setMinter(rewardRouter)")

  // allow rewardRouter to mint in zlpManager
  await sendTxn(zlpManager.setHandler(rewardRouter.address, true), "zlpManager.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeZlpTracker
  await sendTxn(feeZlpTracker.setHandler(rewardRouter.address, true), "feeZlpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedZlpTracker
  await sendTxn(stakedZlpTracker.setHandler(rewardRouter.address, true), "stakedZlpTracker.setHandler(rewardRouter)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
