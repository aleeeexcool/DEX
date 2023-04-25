const { deployContract, contractAt } = require("../shared/helpers")
const { bigNumberify, expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const { MaxUint256 } = ethers.constants
  const precision = 1000000

  const zkeMigrator = await deployContract("ZkeMigrator", [2])
  const gmtZkeIou = await deployContract("ZkeIou", [zkeMigrator.address, "GMT ZKE (IOU)", "GMT:ZKE"])
  const xgmtZkeIou = await deployContract("ZkeIou", [zkeMigrator.address, "xGMT ZKE (IOU)", "xGMT:ZKE"])
  const gmtUsdgZkeIou = await deployContract("ZkeIou", [zkeMigrator.address, "GMT-USDG ZKE (IOU)", "GMT-USDG:ZKE"])
  const xgmtUsdgZkeIou = await deployContract("ZkeIou", [zkeMigrator.address, "xGMT-USDG ZKE (IOU)", "xGMT-USDG:ZKE"])

  const gmt = { address: "0x99e92123eB77Bc8f999316f622e5222498438784" }
  const xgmt = { address: "0xe304ff0983922787Fd84BC9170CD21bF78B16B10" }
  const gmtUsdg = { address: "0xa41e57459f09a126F358E118b693789d088eA8A0" }
  const xgmtUsdg = { address: "0x0b622208fc0691C2486A3AE6B7C875b4A174b317" }
  const usdg = { address: "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7" }

  const ammRouter = { address: "0x10ED43C718714eb63d5aA57B78B54704E256024E" }
  const zkePrice = bigNumberify(2 * precision)

  const signers = [
    "0x45e48668F090a3eD1C7961421c60Df4E66f693BD", // Dovey
    "0x881690382102106b00a99E3dB86056D0fC71eee6", // Han Wen
    "0x2e5d207a4c0f7e7c52f6622dcc6eb44bc0fe1a13" // Krunal Amin
  ]

  const gmtPrice = bigNumberify(10.97 * precision)
  const xgmtPrice = bigNumberify(90.31 * precision)
  const gmtUsdgPrice = bigNumberify(parseInt(6.68 * precision * 1.1))
  const xgmtUsdgPrice = bigNumberify(parseInt(19.27 * precision * 1.1))

  const whitelistedTokens = [gmt.address, xgmt.address, gmtUsdg.address, xgmtUsdg.address]
  const iouTokens = [gmtZkeIou.address, xgmtZkeIou.address, gmtUsdgZkeIou.address, xgmtUsdgZkeIou.address]
  const prices = [gmtPrice, xgmtPrice, gmtUsdgPrice, xgmtUsdgPrice]
  const caps = [MaxUint256, MaxUint256, expandDecimals(483129, 18), expandDecimals(150191, 18)]
  const lpTokens = [gmtUsdg.address, xgmtUsdg.address]
  const lpTokenAs = [gmt.address, xgmt.address]
  const lpTokenBs = [usdg.address, usdg.address]

  await zkeMigrator.initialize(
    ammRouter.address,
    zkePrice,
    signers,
    whitelistedTokens,
    iouTokens,
    prices,
    caps,
    lpTokens,
    lpTokenAs,
    lpTokenBs
  )
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
