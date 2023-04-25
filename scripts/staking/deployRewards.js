const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }
  const { AddressZero } = ethers.constants

  const weth = { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" }
  const zke = await deployContract("ZKE", []);
  const esZke = await deployContract("EsZKE", []);
  const bnZke = await deployContract("MintableBaseToken", ["Bonus ZKE", "bnZKE", 0]);
  const bnAlp = { address: AddressZero }
  const alp = { address: AddressZero }

  const stakedZkeTracker = await deployContract("RewardTracker", ["Staked ZKE", "sZKE"])
  const stakedZkeDistributor = await deployContract("RewardDistributor", [esZke.address, stakedZkeTracker.address])
  await sendTxn(stakedZkeTracker.initialize([zke.address, esZke.address], stakedZkeDistributor.address), "stakedZkeTracker.initialize")
  await sendTxn(stakedZkeDistributor.updateLastDistributionTime(), "stakedZkeDistributor.updateLastDistributionTime")

  const bonusZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus ZKE", "sbZKE"])
  const bonusZkeDistributor = await deployContract("BonusDistributor", [bnZke.address, bonusZkeTracker.address])
  await sendTxn(bonusZkeTracker.initialize([stakedZkeTracker.address], bonusZkeDistributor.address), "bonusZkeTracker.initialize")
  await sendTxn(bonusZkeDistributor.updateLastDistributionTime(), "bonusZkeDistributor.updateLastDistributionTime")

  const feeZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee ZKE", "sbfZKE"])
  const feeZkeDistributor = await deployContract("RewardDistributor", [weth.address, feeZkeTracker.address])
  await sendTxn(feeZkeTracker.initialize([bonusZkeTracker.address, bnZke.address], feeZkeDistributor.address), "feeZkeTracker.initialize")
  await sendTxn(feeZkeDistributor.updateLastDistributionTime(), "feeZkeDistributor.updateLastDistributionTime")

  const feeZlpTracker = { address: AddressZero }
  const stakedZlpTracker = { address: AddressZero }

  const stakedAlpTracker = { address: AddressZero }
  const bonusAlpTracker = { address: AddressZero }
  const feeAlpTracker = { address: AddressZero }

  const zlpManager = { address: AddressZero }
  const zlp = { address: AddressZero }

  await sendTxn(stakedZkeTracker.setInPrivateTransferMode(true), "stakedZkeTracker.setInPrivateTransferMode")
  await sendTxn(stakedZkeTracker.setInPrivateStakingMode(true), "stakedZkeTracker.setInPrivateStakingMode")
  await sendTxn(bonusZkeTracker.setInPrivateTransferMode(true), "bonusZkeTracker.setInPrivateTransferMode")
  await sendTxn(bonusZkeTracker.setInPrivateStakingMode(true), "bonusZkeTracker.setInPrivateStakingMode")
  await sendTxn(bonusZkeTracker.setInPrivateClaimingMode(true), "bonusZkeTracker.setInPrivateClaimingMode")
  await sendTxn(feeZkeTracker.setInPrivateTransferMode(true), "feeZkeTracker.setInPrivateTransferMode")
  await sendTxn(feeZkeTracker.setInPrivateStakingMode(true), "feeZkeTracker.setInPrivateStakingMode")

  const rewardRouter = await deployContract("RewardRouter", [])

  await sendTxn(rewardRouter.initialize(
    zke.address,
    esZke.address,
    bnZke.address,
    bnAlp.address,
    zlp.address,
    alp.address,
    stakedZkeTracker.address,
    bonusZkeTracker.address,
    feeZkeTracker.address,
    feeZlpTracker.address,
    stakedZlpTracker.address,
    stakedAlpTracker.address,
    bonusAlpTracker.address,
    feeAlpTracker.address,
    zlpManager.address
  ), "rewardRouter.initialize")

  // allow rewardRouter to stake in stakedZkeTracker
  await sendTxn(stakedZkeTracker.setHandler(rewardRouter.address, true), "stakedZkeTracker.setHandler(rewardRouter)")
  // allow bonusZkeTracker to stake stakedZkeTracker
  await sendTxn(stakedZkeTracker.setHandler(bonusZkeTracker.address, true), "stakedZkeTracker.setHandler(bonusZkeTracker)")
  // allow rewardRouter to stake in bonusZkeTracker
  await sendTxn(bonusZkeTracker.setHandler(rewardRouter.address, true), "bonusZkeTracker.setHandler(rewardRouter)")
  // allow bonusZkeTracker to stake feeZkeTracker
  await sendTxn(bonusZkeTracker.setHandler(feeZkeTracker.address, true), "bonusZkeTracker.setHandler(feeZkeTracker)")
  await sendTxn(bonusZkeDistributor.setBonusMultiplier(10000), "bonusZkeDistributor.setBonusMultiplier")
  // allow rewardRouter to stake in feeZkeTracker
  await sendTxn(feeZkeTracker.setHandler(rewardRouter.address, true), "feeZkeTracker.setHandler(rewardRouter)")
  // allow stakedZkeTracker to stake esZke
  await sendTxn(esZke.setHandler(stakedZkeTracker.address, true), "esZke.setHandler(stakedZkeTracker)")
  // allow feeZkeTracker to stake bnZke
  await sendTxn(bnZke.setHandler(feeZkeTracker.address, true), "bnZke.setHandler(feeZkeTracker")
  // allow rewardRouter to burn bnZke
  await sendTxn(bnZke.setMinter(rewardRouter.address, true), "bnZke.setMinter(rewardRouter")

  // mint esZke for distributors
  await sendTxn(esZke.setMinter(wallet.address, true), "esZke.setMinter(wallet)")
  await sendTxn(esZke.mint(stakedZkeDistributor.address, expandDecimals(50000 * 12, 18)), "esZke.mint(stakedZkeDistributor") // ~50,000 ZKE per month
  await sendTxn(stakedZkeDistributor.setTokensPerInterval("20667989410000000"), "stakedZkeDistributor.setTokensPerInterval") // 0.02066798941 esZke per second

  // mint bnZke for distributor
  await sendTxn(bnZke.setMinter(wallet.address, true), "bnZke.setMinter")
  await sendTxn(bnZke.mint(bonusZkeDistributor.address, expandDecimals(15 * 1000 * 1000, 18)), "bnZke.mint(bonusZkeDistributor)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
