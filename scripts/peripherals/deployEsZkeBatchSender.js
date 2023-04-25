const { getFrameSigner, deployContract, contractAt, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

async function getArbValues() {
  const signer = await getFrameSigner()

  const esZke = await contractAt("EsZKE", "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA")
  const esZkeGov = await contractAt("Timelock", await esZke.gov(), signer)
  const zkeVester = await contractAt("Vester", "0x199070DDfd1CFb69173aa2F7e20906F26B363004")
  const zkeVesterGov = await contractAt("Timelock", await zkeVester.gov(), signer)
  const zlpVester = await contractAt("Vester", "0xA75287d2f8b217273E7FCD7E86eF07D33972042E")
  const zlpVesterGov = await contractAt("Timelock", await zlpVester.gov(), signer)

  return { esZke, esZkeGov, zkeVester, zkeVesterGov, zlpVester, zlpVesterGov }
}

async function getAvaxValues() {
  const signer = await getFrameSigner()

  const esZke = await contractAt("EsZKE", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17")
  const esZkeGov = await contractAt("Timelock", await esZke.gov(), signer)
  const zkeVester = await contractAt("Vester", "0x472361d3cA5F49c8E633FB50385BfaD1e018b445")
  const zkeVesterGov = await contractAt("Timelock", await zkeVester.gov(), signer)
  const zlpVester = await contractAt("Vester", "0x62331A7Bd1dfB3A7642B7db50B5509E57CA3154A")
  const zlpVesterGov = await contractAt("Timelock", await zlpVester.gov(), signer)

  return { esZke, esZkeGov, zkeVester, zkeVesterGov, zlpVester, zlpVesterGov }
}

async function main() {
  const method = network === "arbitrum" ? getArbValues : getAvaxValues
  const { esZke, esZkeGov, zkeVester, zkeVesterGov, zlpVester, zlpVesterGov } = await method()

  const esZkeBatchSender = await deployContract("EsZkeBatchSender", [esZke.address])

  console.log("esZke", esZke.address)
  console.log("esZkeGov", esZkeGov.address)
  console.log("zkeVester", zkeVester.address)
  console.log("zkeVesterGov", zkeVesterGov.address)
  console.log("zlpVester", zlpVester.address)
  console.log("zlpVesterGov", zlpVesterGov.address)

  await sendTxn(esZkeGov.signalSetHandler(esZke.address, esZkeBatchSender.address, true), "esZkeGov.signalSetHandler")
  await sendTxn(zkeVesterGov.signalSetHandler(zkeVester.address, esZkeBatchSender.address, true), "zkeVesterGov.signalSetHandler")
  await sendTxn(zlpVesterGov.signalSetHandler(zlpVester.address, esZkeBatchSender.address, true), "zlpVesterGov.signalSetHandler")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
