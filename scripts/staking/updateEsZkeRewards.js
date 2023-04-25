const { contractAt, signers, updateTokensPerInterval } = require("../shared/helpers")
const { expandDecimals, bigNumberify } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

const shouldSendTxn = true

const monthlyEsZkeForZlpOnArb = expandDecimals(toInt("0"), 18)
const monthlyEsZkeForZlpOnAvax = expandDecimals(toInt("0"), 18)

async function getStakedAmounts() {
  const arbStakedZkeTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4", signers.arbitrum)
  const arbStakedZkeAndEsZke =await arbStakedZkeTracker.totalSupply()

  const avaxStakedZkeTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4", signers.avax)
  const avaxStakedZkeAndEsZke =await avaxStakedZkeTracker.totalSupply()

  return {
    arbStakedZkeAndEsZke,
    avaxStakedZkeAndEsZke
  }
}

async function getArbValues() {
  const zkeRewardTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const zlpRewardTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")
  const tokenDecimals = 18
  const monthlyEsZkeForZlp = monthlyEsZkeForZlpOnArb

  return { tokenDecimals, zkeRewardTracker, zlpRewardTracker, monthlyEsZkeForZlp }
}

async function getAvaxValues() {
  const zkeRewardTracker = await contractAt("RewardTracker", "0x2bD10f8E93B3669b6d42E74eEedC65dd1B0a1342")
  const zlpRewardTracker = await contractAt("RewardTracker", "0x9e295B5B976a184B14aD8cd72413aD846C299660")
  const tokenDecimals = 18
  const monthlyEsZkeForZlp = monthlyEsZkeForZlpOnAvax

  return { tokenDecimals, zkeRewardTracker, zlpRewardTracker, monthlyEsZkeForZlp }
}

function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }
}

function toInt(value) {
  return parseInt(value.replaceAll(",", ""))
}

async function main() {
  const { arbStakedZkeAndEsZke, avaxStakedZkeAndEsZke } = await getStakedAmounts()
  const { tokenDecimals, zkeRewardTracker, zlpRewardTracker, monthlyEsZkeForZlp } = await getValues()

  const stakedAmounts = {
    arbitrum: {
      total: arbStakedZkeAndEsZke
    },
    avax: {
      total: avaxStakedZkeAndEsZke
    }
  }

  let totalStaked = bigNumberify(0)

  for (const net in stakedAmounts) {
    totalStaked = totalStaked.add(stakedAmounts[net].total)
  }

  const totalEsZkeRewards = expandDecimals(0, tokenDecimals)
  const secondsPerMonth = 28 * 24 * 60 * 60

  const zkeRewardDistributor = await contractAt("RewardDistributor", await zkeRewardTracker.distributor())

  const zkeCurrentTokensPerInterval = await zkeRewardDistributor.tokensPerInterval()
  const zkeNextTokensPerInterval = totalEsZkeRewards.mul(stakedAmounts[network].total).div(totalStaked).div(secondsPerMonth)
  const zkeDelta = zkeNextTokensPerInterval.sub(zkeCurrentTokensPerInterval).mul(10000).div(zkeCurrentTokensPerInterval)

  console.log("zkeCurrentTokensPerInterval", zkeCurrentTokensPerInterval.toString())
  console.log("zkeNextTokensPerInterval", zkeNextTokensPerInterval.toString(), `${zkeDelta.toNumber() / 100.00}%`)

  const zlpRewardDistributor = await contractAt("RewardDistributor", await zlpRewardTracker.distributor())

  const zlpCurrentTokensPerInterval = await zlpRewardDistributor.tokensPerInterval()
  const zlpNextTokensPerInterval = monthlyEsZkeForZlp.div(secondsPerMonth)

  console.log("zlpCurrentTokensPerInterval", zlpCurrentTokensPerInterval.toString())
  console.log("zlpNextTokensPerInterval", zlpNextTokensPerInterval.toString())

  if (shouldSendTxn) {
    await updateTokensPerInterval(zkeRewardDistributor, zkeNextTokensPerInterval, "zkeRewardDistributor")
    await updateTokensPerInterval(zlpRewardDistributor, zlpNextTokensPerInterval, "zlpRewardDistributor")
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
