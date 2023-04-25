const { deployContract, contractAt, writeTmpAddresses } = require("../shared/helpers")

async function main() {
  // await deployContract("EsZKE", [])
  // await deployContract("ZLP", [])
  await deployContract("MintableBaseToken", ["esZKE IOU", "esZKE:IOU", 0])
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
