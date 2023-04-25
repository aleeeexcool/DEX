const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract, deployVault } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed, print, newWallet } = require("../shared/utilities")
const { toChainlinkPrice } = require("../shared/chainlink")
const { toUsd, toNormalizedPrice } = require("../shared/units")
const { initVault, getBnbConfig, getBtcConfig, getDaiConfig } = require("../core/Vault/helpers")
const { ADDRESS_ZERO } = require("@uniswap/v3-sdk")

use(solidity)

describe("RewardRouter", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()

  let vault
  let zlpManager
  let zlp
  let usdg
  let router
  let vaultPriceFeed
  let bnb
  let bnbPriceFeed
  let btc
  let btcPriceFeed
  let eth
  let ethPriceFeed
  let dai
  let daiPriceFeed
  let busd
  let busdPriceFeed

  let zke
  let esZke
  let bnZke

  let stakedZkeTracker
  let stakedZkeDistributor
  let bonusZkeTracker
  let bonusZkeDistributor
  let feeZkeTracker
  let feeZkeDistributor

  let feeZlpTracker
  let feeZlpDistributor
  let stakedZlpTracker
  let stakedZlpDistributor

  let rewardRouter

  beforeEach(async () => {
    bnb = await deployContract("Token", [])
    bnbPriceFeed = await deployContract("PriceFeed", [])

    btc = await deployContract("Token", [])
    btcPriceFeed = await deployContract("PriceFeed", [])

    eth = await deployContract("Token", [])
    ethPriceFeed = await deployContract("PriceFeed", [])

    dai = await deployContract("Token", [])
    daiPriceFeed = await deployContract("PriceFeed", [])

    busd = await deployContract("Token", [])
    busdPriceFeed = await deployContract("PriceFeed", [])

    vault = await deployVault()
    usdg = await deployContract("USDG", [vault.address])
    router = await deployContract("Router", [vault.address, usdg.address, bnb.address])
    vaultPriceFeed = await deployContract("VaultPriceFeed", [])
    zlp = await deployContract("ZLP", [])

    await initVault(vault, router, usdg, vaultPriceFeed)
    zlpManager = await deployContract("ZlpManager", [vault.address, usdg.address, zlp.address, ethers.constants.AddressZero, 24 * 60 * 60])

    await vaultPriceFeed.setTokenConfig(bnb.address, bnbPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(btc.address, btcPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(eth.address, ethPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(dai.address, daiPriceFeed.address, 8, false)

    await daiPriceFeed.setLatestAnswer(toChainlinkPrice(1))
    await vault.setTokenConfig(...getDaiConfig(dai, daiPriceFeed))

    await btcPriceFeed.setLatestAnswer(toChainlinkPrice(60000))
    await vault.setTokenConfig(...getBtcConfig(btc, btcPriceFeed))

    await bnbPriceFeed.setLatestAnswer(toChainlinkPrice(300))
    await vault.setTokenConfig(...getBnbConfig(bnb, bnbPriceFeed))

    await zlp.setInPrivateTransferMode(true)
    await zlp.setMinter(zlpManager.address, true)
    await zlpManager.setInPrivateMode(true)

    zke = await deployContract("ZKE", []);
    esZke = await deployContract("EsZKE", []);
    bnZke = await deployContract("MintableBaseToken", ["Bonus ZKE", "bnZKE", 0]);

    // ZKE
    stakedZkeTracker = await deployContract("RewardTracker", ["Staked ZKE", "sZKE"])
    stakedZkeDistributor = await deployContract("RewardDistributor", [esZke.address, stakedZkeTracker.address])
    await stakedZkeTracker.initialize([zke.address, esZke.address], stakedZkeDistributor.address)
    await stakedZkeDistributor.updateLastDistributionTime()

    bonusZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus ZKE", "sbZKE"])
    bonusZkeDistributor = await deployContract("BonusDistributor", [bnZke.address, bonusZkeTracker.address])
    await bonusZkeTracker.initialize([stakedZkeTracker.address], bonusZkeDistributor.address)
    await bonusZkeDistributor.updateLastDistributionTime()

    feeZkeTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee ZKE", "sbfZKE"])
    feeZkeDistributor = await deployContract("RewardDistributor", [eth.address, feeZkeTracker.address])
    await feeZkeTracker.initialize([bonusZkeTracker.address, bnZke.address], feeZkeDistributor.address)
    await feeZkeDistributor.updateLastDistributionTime()

    // ZLP
    feeZlpTracker = await deployContract("RewardTracker", ["Fee ZLP", "fZLP"])
    feeZlpDistributor = await deployContract("RewardDistributor", [eth.address, feeZlpTracker.address])
    await feeZlpTracker.initialize([zlp.address], feeZlpDistributor.address)
    await feeZlpDistributor.updateLastDistributionTime()

    stakedZlpTracker = await deployContract("RewardTracker", ["Fee + Staked ZLP", "fsZLP"])
    stakedZlpDistributor = await deployContract("RewardDistributor", [esZke.address, stakedZlpTracker.address])
    await stakedZlpTracker.initialize([feeZlpTracker.address], stakedZlpDistributor.address)
    await stakedZlpDistributor.updateLastDistributionTime()

    await stakedZkeTracker.setInPrivateTransferMode(true)
    await stakedZkeTracker.setInPrivateStakingMode(true)
    await bonusZkeTracker.setInPrivateTransferMode(true)
    await bonusZkeTracker.setInPrivateStakingMode(true)
    await bonusZkeTracker.setInPrivateClaimingMode(true)
    await feeZkeTracker.setInPrivateTransferMode(true)
    await feeZkeTracker.setInPrivateStakingMode(true)

    await feeZlpTracker.setInPrivateTransferMode(true)
    await feeZlpTracker.setInPrivateStakingMode(true)
    await stakedZlpTracker.setInPrivateTransferMode(true)
    await stakedZlpTracker.setInPrivateStakingMode(true)

    rewardRouter = await deployContract("RewardRouter", [])
    await rewardRouter.initialize(
      bnb.address,
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
    )

    // allow rewardRouter to stake in stakedZkeTracker
    await stakedZkeTracker.setHandler(rewardRouter.address, true)
    // allow bonusZkeTracker to stake stakedZkeTracker
    await stakedZkeTracker.setHandler(bonusZkeTracker.address, true)
    // allow rewardRouter to stake in bonusZkeTracker
    await bonusZkeTracker.setHandler(rewardRouter.address, true)
    // allow bonusZkeTracker to stake feeZkeTracker
    await bonusZkeTracker.setHandler(feeZkeTracker.address, true)
    await bonusZkeDistributor.setBonusMultiplier(10000)
    // allow rewardRouter to stake in feeZkeTracker
    await feeZkeTracker.setHandler(rewardRouter.address, true)
    // allow feeZkeTracker to stake bnZke
    await bnZke.setHandler(feeZkeTracker.address, true)
    // allow rewardRouter to burn bnZke
    await bnZke.setMinter(rewardRouter.address, true)

    // allow rewardRouter to mint in zlpManager
    await zlpManager.setHandler(rewardRouter.address, true)
    // allow rewardRouter to stake in feeZlpTracker
    await feeZlpTracker.setHandler(rewardRouter.address, true)
    // allow stakedZlpTracker to stake feeZlpTracker
    await feeZlpTracker.setHandler(stakedZlpTracker.address, true)
    // allow rewardRouter to sake in stakedZlpTracker
    await stakedZlpTracker.setHandler(rewardRouter.address, true)
    // allow feeZlpTracker to stake zlp
    await zlp.setHandler(feeZlpTracker.address, true)

    // mint esZke for distributors
    await esZke.setMinter(wallet.address, true)
    await esZke.mint(stakedZkeDistributor.address, expandDecimals(50000, 18))
    await stakedZkeDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esZke per second
    await esZke.mint(stakedZlpDistributor.address, expandDecimals(50000, 18))
    await stakedZlpDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esZke per second

    await esZke.setInPrivateTransferMode(true)
    await esZke.setHandler(stakedZkeDistributor.address, true)
    await esZke.setHandler(stakedZlpDistributor.address, true)
    await esZke.setHandler(stakedZkeTracker.address, true)
    await esZke.setHandler(stakedZlpTracker.address, true)
    await esZke.setHandler(rewardRouter.address, true)

    // mint bnZke for distributor
    await bnZke.setMinter(wallet.address, true)
    await bnZke.mint(bonusZkeDistributor.address, expandDecimals(1500, 18))
  })

  it("inits", async () => {
    expect(await rewardRouter.isInitialized()).eq(true)

    expect(await rewardRouter.weth()).eq(bnb.address)
    expect(await rewardRouter.zke()).eq(zke.address)
    expect(await rewardRouter.esZke()).eq(esZke.address)
    expect(await rewardRouter.bnZke()).eq(bnZke.address)

    expect(await rewardRouter.zlp()).eq(zlp.address)

    expect(await rewardRouter.stakedZkeTracker()).eq(stakedZkeTracker.address)
    expect(await rewardRouter.bonusZkeTracker()).eq(bonusZkeTracker.address)
    expect(await rewardRouter.feeZkeTracker()).eq(feeZkeTracker.address)

    expect(await rewardRouter.feeZlpTracker()).eq(feeZlpTracker.address)
    expect(await rewardRouter.stakedZlpTracker()).eq(stakedZlpTracker.address)

    expect(await rewardRouter.zlpManager()).eq(zlpManager.address)

    await expect(rewardRouter.initialize(
      bnb.address,
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
    )).to.be.revertedWith("RewardRouter: already initialized")
  })

  it("stakeZkeForAccount, stakeZke, stakeEsZke, unstakeZke, unstakeEsZke, claimEsZke, claimFees, compound, batchCompoundForAccounts", async () => {
    await eth.mint(feeZkeDistributor.address, expandDecimals(100, 18))
    await feeZkeDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await zke.setMinter(wallet.address, true)
    await zke.mint(user0.address, expandDecimals(1500, 18))
    expect(await zke.balanceOf(user0.address)).eq(expandDecimals(1500, 18))

    await zke.connect(user0).approve(stakedZkeTracker.address, expandDecimals(1000, 18))
    await expect(rewardRouter.connect(user0).stakeZkeForAccount(user1.address, expandDecimals(1000, 18)))
      .to.be.revertedWith("Governable: forbidden")

    await rewardRouter.setGov(user0.address)
    await rewardRouter.connect(user0).stakeZkeForAccount(user1.address, expandDecimals(800, 18))
    expect(await zke.balanceOf(user0.address)).eq(expandDecimals(700, 18))

    await zke.mint(user1.address, expandDecimals(200, 18))
    expect(await zke.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await zke.connect(user1).approve(stakedZkeTracker.address, expandDecimals(200, 18))
    await rewardRouter.connect(user1).stakeZke(expandDecimals(200, 18))
    expect(await zke.balanceOf(user1.address)).eq(0)

    expect(await stakedZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await stakedZkeTracker.depositBalances(user0.address, zke.address)).eq(0)
    expect(await stakedZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(expandDecimals(1000, 18))

    expect(await bonusZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusZkeTracker.depositBalances(user0.address, stakedZkeTracker.address)).eq(0)
    expect(await bonusZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusZkeTracker.depositBalances(user1.address, stakedZkeTracker.address)).eq(expandDecimals(1000, 18))

    expect(await feeZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeZkeTracker.depositBalances(user0.address, bonusZkeTracker.address)).eq(0)
    expect(await feeZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).eq(expandDecimals(1000, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedZkeTracker.claimable(user0.address)).eq(0)
    expect(await stakedZkeTracker.claimable(user1.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await stakedZkeTracker.claimable(user1.address)).lt(expandDecimals(1786, 18))

    expect(await bonusZkeTracker.claimable(user0.address)).eq(0)
    expect(await bonusZkeTracker.claimable(user1.address)).gt("2730000000000000000") // 2.73, 1000 / 365 => ~2.74
    expect(await bonusZkeTracker.claimable(user1.address)).lt("2750000000000000000") // 2.75

    expect(await feeZkeTracker.claimable(user0.address)).eq(0)
    expect(await feeZkeTracker.claimable(user1.address)).gt("3560000000000000000") // 3.56, 100 / 28 => ~3.57
    expect(await feeZkeTracker.claimable(user1.address)).lt("3580000000000000000") // 3.58

    await esZke.setMinter(wallet.address, true)
    await esZke.mint(user2.address, expandDecimals(500, 18))
    await rewardRouter.connect(user2).stakeEsZke(expandDecimals(500, 18))

    expect(await stakedZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await stakedZkeTracker.depositBalances(user0.address, zke.address)).eq(0)
    expect(await stakedZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(expandDecimals(1000, 18))
    expect(await stakedZkeTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await stakedZkeTracker.depositBalances(user2.address, esZke.address)).eq(expandDecimals(500, 18))

    expect(await bonusZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusZkeTracker.depositBalances(user0.address, stakedZkeTracker.address)).eq(0)
    expect(await bonusZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusZkeTracker.depositBalances(user1.address, stakedZkeTracker.address)).eq(expandDecimals(1000, 18))
    expect(await bonusZkeTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await bonusZkeTracker.depositBalances(user2.address, stakedZkeTracker.address)).eq(expandDecimals(500, 18))

    expect(await feeZkeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeZkeTracker.depositBalances(user0.address, bonusZkeTracker.address)).eq(0)
    expect(await feeZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).eq(expandDecimals(1000, 18))
    expect(await feeZkeTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await feeZkeTracker.depositBalances(user2.address, bonusZkeTracker.address)).eq(expandDecimals(500, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedZkeTracker.claimable(user0.address)).eq(0)
    expect(await stakedZkeTracker.claimable(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await stakedZkeTracker.claimable(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await stakedZkeTracker.claimable(user2.address)).gt(expandDecimals(595, 18))
    expect(await stakedZkeTracker.claimable(user2.address)).lt(expandDecimals(596, 18))

    expect(await bonusZkeTracker.claimable(user0.address)).eq(0)
    expect(await bonusZkeTracker.claimable(user1.address)).gt("5470000000000000000") // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusZkeTracker.claimable(user1.address)).lt("5490000000000000000")
    expect(await bonusZkeTracker.claimable(user2.address)).gt("1360000000000000000") // 1.36, 500 / 365 => ~1.37
    expect(await bonusZkeTracker.claimable(user2.address)).lt("1380000000000000000")

    expect(await feeZkeTracker.claimable(user0.address)).eq(0)
    expect(await feeZkeTracker.claimable(user1.address)).gt("5940000000000000000") // 5.94, 3.57 + 100 / 28 / 3 * 2 => ~5.95
    expect(await feeZkeTracker.claimable(user1.address)).lt("5960000000000000000")
    expect(await feeZkeTracker.claimable(user2.address)).gt("1180000000000000000") // 1.18, 100 / 28 / 3 => ~1.19
    expect(await feeZkeTracker.claimable(user2.address)).lt("1200000000000000000")

    expect(await esZke.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimEsZke()
    expect(await esZke.balanceOf(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esZke.balanceOf(user1.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await eth.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimFees()
    expect(await eth.balanceOf(user1.address)).gt("5940000000000000000")
    expect(await eth.balanceOf(user1.address)).lt("5960000000000000000")

    expect(await esZke.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimEsZke()
    expect(await esZke.balanceOf(user2.address)).gt(expandDecimals(595, 18))
    expect(await esZke.balanceOf(user2.address)).lt(expandDecimals(596, 18))

    expect(await eth.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimFees()
    expect(await eth.balanceOf(user2.address)).gt("1180000000000000000")
    expect(await eth.balanceOf(user2.address)).lt("1200000000000000000")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx0 = await rewardRouter.connect(user1).compound()
    await reportGasUsed(provider, tx0, "compound gas used")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx1 = await rewardRouter.connect(user0).batchCompoundForAccounts([user1.address, user2.address])
    await reportGasUsed(provider, tx1, "batchCompoundForAccounts gas used")

    expect(await stakedZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await stakedZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(expandDecimals(1000, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).gt(expandDecimals(2643, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).lt(expandDecimals(2645, 18))

    expect(await bonusZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await bonusZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))

    expect(await feeZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3657, 18))
    expect(await feeZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3659, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).gt(expandDecimals(3643, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).lt(expandDecimals(3645, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).gt("14100000000000000000") // 14.1
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).lt("14300000000000000000") // 14.3

    expect(await zke.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).unstakeZke(expandDecimals(300, 18))
    expect(await zke.balanceOf(user1.address)).eq(expandDecimals(300, 18))

    expect(await stakedZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await stakedZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(expandDecimals(700, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).gt(expandDecimals(2643, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).lt(expandDecimals(2645, 18))

    expect(await bonusZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await bonusZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))

    expect(await feeZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3357, 18))
    expect(await feeZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3359, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).gt(expandDecimals(3343, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).lt(expandDecimals(3345, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).gt("13000000000000000000") // 13
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).lt("13100000000000000000") // 13.1

    const esZkeBalance1 = await esZke.balanceOf(user1.address)
    const esZkeUnstakeBalance1 = await stakedZkeTracker.depositBalances(user1.address, esZke.address)
    await rewardRouter.connect(user1).unstakeEsZke(esZkeUnstakeBalance1)
    expect(await esZke.balanceOf(user1.address)).eq(esZkeBalance1.add(esZkeUnstakeBalance1))

    expect(await stakedZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(expandDecimals(700, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).eq(0)

    expect(await bonusZkeTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))

    expect(await feeZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(702, 18))
    expect(await feeZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(703, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).eq(expandDecimals(700, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).gt("2720000000000000000") // 2.72
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).lt("2740000000000000000") // 2.74

    await expect(rewardRouter.connect(user1).unstakeEsZke(expandDecimals(1, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance")
  })

  it("mintAndStakeZlp, unstakeAndRedeemZlp, compound, batchCompoundForAccounts", async () => {
    await eth.mint(feeZlpDistributor.address, expandDecimals(100, 18))
    await feeZlpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(zlpManager.address, expandDecimals(1, 18))
    const tx0 = await rewardRouter.connect(user1).mintAndStakeZlp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )
    await reportGasUsed(provider, tx0, "mintAndStakeZlp gas used")

    expect(await feeZlpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeZlpTracker.depositBalances(user1.address, zlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedZlpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedZlpTracker.depositBalances(user1.address, feeZlpTracker.address)).eq(expandDecimals(2991, 17))

    await bnb.mint(user1.address, expandDecimals(2, 18))
    await bnb.connect(user1).approve(zlpManager.address, expandDecimals(2, 18))
    await rewardRouter.connect(user1).mintAndStakeZlp(
      bnb.address,
      expandDecimals(2, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await increaseTime(provider, 24 * 60 * 60 + 1)
    await mineBlock(provider)

    expect(await feeZlpTracker.claimable(user1.address)).gt("3560000000000000000") // 3.56, 100 / 28 => ~3.57
    expect(await feeZlpTracker.claimable(user1.address)).lt("3580000000000000000") // 3.58

    expect(await stakedZlpTracker.claimable(user1.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await stakedZlpTracker.claimable(user1.address)).lt(expandDecimals(1786, 18))

    await bnb.mint(user2.address, expandDecimals(1, 18))
    await bnb.connect(user2).approve(zlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user2).mintAndStakeZlp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await expect(rewardRouter.connect(user2).unstakeAndRedeemZlp(
      bnb.address,
      expandDecimals(299, 18),
      "990000000000000000", // 0.99
      user2.address
    )).to.be.revertedWith("ZlpManager: cooldown duration not yet passed")

    expect(await feeZlpTracker.stakedAmounts(user1.address)).eq("897300000000000000000") // 897.3
    expect(await stakedZlpTracker.stakedAmounts(user1.address)).eq("897300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq(0)

    const tx1 = await rewardRouter.connect(user1).unstakeAndRedeemZlp(
      bnb.address,
      expandDecimals(299, 18),
      "990000000000000000", // 0.99
      user1.address
    )
    await reportGasUsed(provider, tx1, "unstakeAndRedeemZlp gas used")

    expect(await feeZlpTracker.stakedAmounts(user1.address)).eq("598300000000000000000") // 598.3
    expect(await stakedZlpTracker.stakedAmounts(user1.address)).eq("598300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq("993676666666666666") // ~0.99

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await feeZlpTracker.claimable(user1.address)).gt("5940000000000000000") // 5.94, 3.57 + 100 / 28 / 3 * 2 => ~5.95
    expect(await feeZlpTracker.claimable(user1.address)).lt("5960000000000000000")
    expect(await feeZlpTracker.claimable(user2.address)).gt("1180000000000000000") // 1.18, 100 / 28 / 3 => ~1.19
    expect(await feeZlpTracker.claimable(user2.address)).lt("1200000000000000000")

    expect(await stakedZlpTracker.claimable(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await stakedZlpTracker.claimable(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await stakedZlpTracker.claimable(user2.address)).gt(expandDecimals(595, 18))
    expect(await stakedZlpTracker.claimable(user2.address)).lt(expandDecimals(596, 18))

    expect(await esZke.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimEsZke()
    expect(await esZke.balanceOf(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esZke.balanceOf(user1.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await eth.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimFees()
    expect(await eth.balanceOf(user1.address)).gt("5940000000000000000")
    expect(await eth.balanceOf(user1.address)).lt("5960000000000000000")

    expect(await esZke.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimEsZke()
    expect(await esZke.balanceOf(user2.address)).gt(expandDecimals(595, 18))
    expect(await esZke.balanceOf(user2.address)).lt(expandDecimals(596, 18))

    expect(await eth.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimFees()
    expect(await eth.balanceOf(user2.address)).gt("1180000000000000000")
    expect(await eth.balanceOf(user2.address)).lt("1200000000000000000")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx2 = await rewardRouter.connect(user1).compound()
    await reportGasUsed(provider, tx2, "compound gas used")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx3 = await rewardRouter.batchCompoundForAccounts([user1.address, user2.address])
    await reportGasUsed(provider, tx1, "batchCompoundForAccounts gas used")

    expect(await stakedZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(4165, 18))
    expect(await stakedZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(4167, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, zke.address)).eq(0)
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).gt(expandDecimals(4165, 18))
    expect(await stakedZkeTracker.depositBalances(user1.address, esZke.address)).lt(expandDecimals(4167, 18))

    expect(await bonusZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(4165, 18))
    expect(await bonusZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(4167, 18))

    expect(await feeZkeTracker.stakedAmounts(user1.address)).gt(expandDecimals(4179, 18))
    expect(await feeZkeTracker.stakedAmounts(user1.address)).lt(expandDecimals(4180, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).gt(expandDecimals(4165, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bonusZkeTracker.address)).lt(expandDecimals(4167, 18))
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).gt("12900000000000000000") // 12.9
    expect(await feeZkeTracker.depositBalances(user1.address, bnZke.address)).lt("13100000000000000000") // 13.1

    expect(await feeZlpTracker.stakedAmounts(user1.address)).eq("598300000000000000000") // 598.3
    expect(await stakedZlpTracker.stakedAmounts(user1.address)).eq("598300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq("993676666666666666") // ~0.99
  })

  it("mintAndStakeZlpETH, unstakeAndRedeemZlpETH", async () => {
    const receiver0 = newWallet()
    await expect(rewardRouter.connect(user0).mintAndStakeZlpETH(expandDecimals(300, 18), expandDecimals(300, 18), { value: 0 }))
      .to.be.revertedWith("RewardRouter: invalid msg.value")

    await expect(rewardRouter.connect(user0).mintAndStakeZlpETH(expandDecimals(300, 18), expandDecimals(300, 18), { value: expandDecimals(1, 18) }))
      .to.be.revertedWith("ZlpManager: insufficient USDG output")

    await expect(rewardRouter.connect(user0).mintAndStakeZlpETH(expandDecimals(299, 18), expandDecimals(300, 18), { value: expandDecimals(1, 18) }))
      .to.be.revertedWith("ZlpManager: insufficient ZLP output")

    expect(await bnb.balanceOf(user0.address)).eq(0)
    expect(await bnb.balanceOf(vault.address)).eq(0)
    expect(await bnb.totalSupply()).eq(0)
    expect(await provider.getBalance(bnb.address)).eq(0)
    expect(await stakedZlpTracker.balanceOf(user0.address)).eq(0)

    await rewardRouter.connect(user0).mintAndStakeZlpETH(expandDecimals(299, 18), expandDecimals(299, 18), { value: expandDecimals(1, 18) })

    expect(await bnb.balanceOf(user0.address)).eq(0)
    expect(await bnb.balanceOf(vault.address)).eq(expandDecimals(1, 18))
    expect(await provider.getBalance(bnb.address)).eq(expandDecimals(1, 18))
    expect(await bnb.totalSupply()).eq(expandDecimals(1, 18))
    expect(await stakedZlpTracker.balanceOf(user0.address)).eq("299100000000000000000") // 299.1

    await expect(rewardRouter.connect(user0).unstakeAndRedeemZlpETH(expandDecimals(300, 18), expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount")

    await expect(rewardRouter.connect(user0).unstakeAndRedeemZlpETH("299100000000000000000", expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("ZlpManager: cooldown duration not yet passed")

    await increaseTime(provider, 24 * 60 * 60 + 10)

    await expect(rewardRouter.connect(user0).unstakeAndRedeemZlpETH("299100000000000000000", expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("ZlpManager: insufficient output")

    await rewardRouter.connect(user0).unstakeAndRedeemZlpETH("299100000000000000000", "990000000000000000", receiver0.address)
    expect(await provider.getBalance(receiver0.address)).eq("994009000000000000") // 0.994009
    expect(await bnb.balanceOf(vault.address)).eq("5991000000000000") // 0.005991
    expect(await provider.getBalance(bnb.address)).eq("5991000000000000")
    expect(await bnb.totalSupply()).eq("5991000000000000")
  })
})
