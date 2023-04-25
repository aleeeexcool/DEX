const { deployContract, contractAt, writeTmpAddresses } = require("../shared/helpers")

async function main() {
  await deployContract("MintableBaseToken", ["VestingOption", "ARB:ZKE", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "ARB:ZLP", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "AVAX:ZKE", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "AVAX:ZLP", 0])
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
