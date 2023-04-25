const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }

  const account = "0x6eA748d14f28778495A3fBa3550a6CdfBbE555f9"
  const unstakeAmount = "79170000000000000000"

  const rewardRouter = await contractAt("RewardRouter", "0x1b8911995ee36F4F95311D1D9C1845fA18c56Ec6")
  const zke = await contractAt("ZKE", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a");
  const bnZke = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921");
  const stakedZkeTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusZkeTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeZkeTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  // const gasLimit = 30000000

  // await sendTxn(feeZkeTracker.setHandler(wallet.address, true, { gasLimit }), "feeZkeTracker.setHandler")
  // await sendTxn(bonusZkeTracker.setHandler(wallet.address, true, { gasLimit }), "bonusZkeTracker.setHandler")
  // await sendTxn(stakedZkeTracker.setHandler(wallet.address, true, { gasLimit }), "stakedZkeTracker.setHandler")

  const stakedAmount = await stakedZkeTracker.stakedAmounts(account)
  console.log(`${account} staked: ${stakedAmount.toString()}`)
  console.log(`unstakeAmount: ${unstakeAmount.toString()}`)

  await sendTxn(feeZkeTracker.unstakeForAccount(account, bonusZkeTracker.address, unstakeAmount, account), "feeZkeTracker.unstakeForAccount")
  await sendTxn(bonusZkeTracker.unstakeForAccount(account, stakedZkeTracker.address, unstakeAmount, account), "bonusZkeTracker.unstakeForAccount")
  await sendTxn(stakedZkeTracker.unstakeForAccount(account, zke.address, unstakeAmount, account), "stakedZkeTracker.unstakeForAccount")

  await sendTxn(bonusZkeTracker.claimForAccount(account, account), "bonusZkeTracker.claimForAccount")

  const bnZkeAmount = await bnZke.balanceOf(account)
  console.log(`bnZkeAmount: ${bnZkeAmount.toString()}`)

  await sendTxn(feeZkeTracker.stakeForAccount(account, account, bnZke.address, bnZkeAmount), "feeZkeTracker.stakeForAccount")

  const stakedBnZke = await feeZkeTracker.depositBalances(account, bnZke.address)
  console.log(`stakedBnZke: ${stakedBnZke.toString()}`)

  const reductionAmount = stakedBnZke.mul(unstakeAmount).div(stakedAmount)
  console.log(`reductionAmount: ${reductionAmount.toString()}`)
  await sendTxn(feeZkeTracker.unstakeForAccount(account, bnZke.address, reductionAmount, account), "feeZkeTracker.unstakeForAccount")
  await sendTxn(bnZke.burn(account, reductionAmount), "bnZke.burn")

  const zkeAmount = await zke.balanceOf(account)
  console.log(`zkeAmount: ${zkeAmount.toString()}`)

  await sendTxn(zke.burn(account, unstakeAmount), "zke.burn")
  const nextZkeAmount = await zke.balanceOf(account)
  console.log(`nextZkeAmount: ${nextZkeAmount.toString()}`)

  const nextStakedAmount = await stakedZkeTracker.stakedAmounts(account)
  console.log(`nextStakedAmount: ${nextStakedAmount.toString()}`)

  const nextStakedBnZke = await feeZkeTracker.depositBalances(account, bnZke.address)
  console.log(`nextStakedBnZke: ${nextStakedBnZke.toString()}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
