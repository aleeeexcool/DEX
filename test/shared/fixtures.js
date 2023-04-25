const { expandDecimals } = require("./utilities")

async function deployContract(name, args, options) {
  const contractFactory = await ethers.getContractFactory(name, options)
  return await contractFactory.deploy(...args)
}

async function deployVault() {
  const vaultDelegatePartOne = await deployContract("VaultDelegatePartOne", [])
  const vaultDelegatePartTwo = await deployContract("VaultDelegatePartTwo", [])
  const vaultDelegatePartThree = await deployContract("VaultDelegatePartThree", [])
  const vault = await deployContract("Vault", [vaultDelegatePartOne.address, vaultDelegatePartTwo.address, vaultDelegatePartThree.address])
  return vault;
}

async function contractAt(name, address) {
  const contractFactory = await ethers.getContractFactory(name)
  return await contractFactory.attach(address)
}

module.exports = {
  deployContract,
  deployVault,
  contractAt
}
