const { deployContract, contractAt, sendTxn, writeTmpAddresses } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

async function main() {
  const { nativeToken } = tokens

  const vestingDuration = 365 * 24 * 60 * 60

  const zlpManager = await contractAt("ZlpManager", "0xe1ae4d4b06A5Fe1fc288f6B4CD72f9F8323B107F")
  const zlp = await contractAt("ZLP", "0x01234181085565ed162a948b6a5e88758CD7c7b8")

  const zke = await contractAt("ZKE", "0x62edc0692BD897D2295872a9FFCac5425011c661");
  const esZke = await contractAt("EsZKE", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17");
  const bnZke = await deployContract("MintableBaseToken", ["Bonus ZKE", "bnZKE", 0]);

  await sendTxn(esZke.setInPrivateTransferMode(true), "esZke.setInPrivateTransferMode")
  await sendTxn(zlp.setInPrivateTransferMode(true), "zlp.setInPrivateTransferMode")

  const stakedZkeTracker = await deployContract("RewardTracker", ["Staked ZKE", "sZKE"])
  const stakedZkeDistributor = await deployContract("RewardDistributor", [esZke.address, stakedZkeTracker.address])
  await sendTxn(stakedZkeTracker.initialize([zke.address, esZke.address], stakedZkeDistributor.address), "stakedZkeTracker.initialize")
  await sendTxn(stakedZkeDistributor.updateLastDistributionTime(), "stakedZkeDistributor.updateLastDistributionTime")

  const bonusZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus ZKE", "sbZKE"])
  const bonusZkeDistributor = await deployContract("BonusDistributor", [bnZke.address, bonusZkeTracker.address])
  await sendTxn(bonusZkeTracker.initialize([stakedZkeTracker.address], bonusZkeDistributor.address), "bonusZkeTracker.initialize")
  await sendTxn(bonusZkeDistributor.updateLastDistributionTime(), "bonusZkeDistributor.updateLastDistributionTime")

  const feeZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee ZKE", "sbfZKE"])
  const feeZkeDistributor = await deployContract("RewardDistributor", [nativeToken.address, feeZkeTracker.address])
  await sendTxn(feeZkeTracker.initialize([bonusZkeTracker.address, bnZke.address], feeZkeDistributor.address), "feeZkeTracker.initialize")
  await sendTxn(feeZkeDistributor.updateLastDistributionTime(), "feeZkeDistributor.updateLastDistributionTime")

  const feeZlpTracker = await deployContract("RewardTracker", ["Fee ZLP", "fZLP"])
  const feeZlpDistributor = await deployContract("RewardDistributor", [nativeToken.address, feeZlpTracker.address])
  await sendTxn(feeZlpTracker.initialize([zlp.address], feeZlpDistributor.address), "feeZlpTracker.initialize")
  await sendTxn(feeZlpDistributor.updateLastDistributionTime(), "feeZlpDistributor.updateLastDistributionTime")

  const stakedZlpTracker = await deployContract("RewardTracker", ["Fee + Staked ZLP", "fsZLP"])
  const stakedZlpDistributor = await deployContract("RewardDistributor", [esZke.address, stakedZlpTracker.address])
  await sendTxn(stakedZlpTracker.initialize([feeZlpTracker.address], stakedZlpDistributor.address), "stakedZlpTracker.initialize")
  await sendTxn(stakedZlpDistributor.updateLastDistributionTime(), "stakedZlpDistributor.updateLastDistributionTime")

  await sendTxn(stakedZkeTracker.setInPrivateTransferMode(true), "stakedZkeTracker.setInPrivateTransferMode")
  await sendTxn(stakedZkeTracker.setInPrivateStakingMode(true), "stakedZkeTracker.setInPrivateStakingMode")
  await sendTxn(bonusZkeTracker.setInPrivateTransferMode(true), "bonusZkeTracker.setInPrivateTransferMode")
  await sendTxn(bonusZkeTracker.setInPrivateStakingMode(true), "bonusZkeTracker.setInPrivateStakingMode")
  await sendTxn(bonusZkeTracker.setInPrivateClaimingMode(true), "bonusZkeTracker.setInPrivateClaimingMode")
  await sendTxn(feeZkeTracker.setInPrivateTransferMode(true), "feeZkeTracker.setInPrivateTransferMode")
  await sendTxn(feeZkeTracker.setInPrivateStakingMode(true), "feeZkeTracker.setInPrivateStakingMode")

  await sendTxn(feeZlpTracker.setInPrivateTransferMode(true), "feeZlpTracker.setInPrivateTransferMode")
  await sendTxn(feeZlpTracker.setInPrivateStakingMode(true), "feeZlpTracker.setInPrivateStakingMode")
  await sendTxn(stakedZlpTracker.setInPrivateTransferMode(true), "stakedZlpTracker.setInPrivateTransferMode")
  await sendTxn(stakedZlpTracker.setInPrivateStakingMode(true), "stakedZlpTracker.setInPrivateStakingMode")

  const zkeVester = await deployContract("Vester", [
    "Vested ZKE", // _name
    "vZKE", // _symbol
    vestingDuration, // _vestingDuration
    esZke.address, // _esToken
    feeZkeTracker.address, // _pairToken
    zke.address, // _claimableToken
    stakedZkeTracker.address, // _rewardTracker
  ])

  const zlpVester = await deployContract("Vester", [
    "Vested ZLP", // _name
    "vZLP", // _symbol
    vestingDuration, // _vestingDuration
    esZke.address, // _esToken
    stakedZlpTracker.address, // _pairToken
    zke.address, // _claimableToken
    stakedZlpTracker.address, // _rewardTracker
  ])

  const rewardRouter = await deployContract("RewardRouterV2", [])
  await sendTxn(rewardRouter.initialize(
    nativeToken.address,
    zke.address,
    esZke.address,
    bnZke.address,
    zlp.address,
    stakedZkeTracker.address,
    bonusZkeTracker.address,
    feeZkeTracker.address,
    feeZlpTracker.address,
    stakedZlpTracker.address,
    zlpManager.address,
    zkeVester.address,
    zlpVester.address
  ), "rewardRouter.initialize")

  await sendTxn(zlpManager.setHandler(rewardRouter.address), "zlpManager.setHandler(rewardRouter)")

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

  // allow stakedZlpTracker to stake feeZlpTracker
  await sendTxn(feeZlpTracker.setHandler(stakedZlpTracker.address, true), "feeZlpTracker.setHandler(stakedZlpTracker)")
  // allow feeZlpTracker to stake zlp
  await sendTxn(zlp.setHandler(feeZlpTracker.address, true), "zlp.setHandler(feeZlpTracker)")

  // allow rewardRouter to stake in feeZlpTracker
  await sendTxn(feeZlpTracker.setHandler(rewardRouter.address, true), "feeZlpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedZlpTracker
  await sendTxn(stakedZlpTracker.setHandler(rewardRouter.address, true), "stakedZlpTracker.setHandler(rewardRouter)")

  await sendTxn(esZke.setHandler(rewardRouter.address, true), "esZke.setHandler(rewardRouter)")
  await sendTxn(esZke.setHandler(stakedZkeDistributor.address, true), "esZke.setHandler(stakedZkeDistributor)")
  await sendTxn(esZke.setHandler(stakedZlpDistributor.address, true), "esZke.setHandler(stakedZlpDistributor)")
  await sendTxn(esZke.setHandler(stakedZlpTracker.address, true), "esZke.setHandler(stakedZlpTracker)")
  await sendTxn(esZke.setHandler(zkeVester.address, true), "esZke.setHandler(zkeVester)")
  await sendTxn(esZke.setHandler(zlpVester.address, true), "esZke.setHandler(zlpVester)")

  await sendTxn(esZke.setMinter(zkeVester.address, true), "esZke.setMinter(zkeVester)")
  await sendTxn(esZke.setMinter(zlpVester.address, true), "esZke.setMinter(zlpVester)")

  await sendTxn(zkeVester.setHandler(rewardRouter.address, true), "zkeVester.setHandler(rewardRouter)")
  await sendTxn(zlpVester.setHandler(rewardRouter.address, true), "zlpVester.setHandler(rewardRouter)")

  await sendTxn(feeZkeTracker.setHandler(zkeVester.address, true), "feeZkeTracker.setHandler(zkeVester)")
  await sendTxn(stakedZlpTracker.setHandler(zlpVester.address, true), "stakedZlpTracker.setHandler(zlpVester)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
