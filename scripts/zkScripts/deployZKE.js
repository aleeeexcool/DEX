const { ethers } = require('ethers');
const { Wallet, Contract, utils, Provider } = require('zksync-web3');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');
const hre = require('hardhat');
const { accounts } = require("./shared/accounts");

const privateKeyGovernor = "0xe667e57a9b8aaa6709e51ff7d093f1c5b73b63f9987e4ab4aa9a5c699e024ee8"; //0x4F9133D1d3F50011A6859807C837bdCB31Aaab13

const [wallet, user0, user1, user2, user3] = accounts.map(account => new Wallet(account.privateKey));
// const governor = new Wallet(privateKeyGovernor);
const deployer = new Deployer(hre, wallet);

async function deployContract(name, args, options) {
    try {
        const argStr = args.map((i) => `"${i}"`).join(", ")
        console.info(`Deploying...  ${name}(${argStr})`)
        const artifact = await deployer.loadArtifact(name);
        const contract = await deployer.deploy(artifact, [...args]);
        console.info(`Completed: ${contract.address}\n`)
        return contract
    } catch (error) {
        console.error(`${error.code}`);
        console.error(`${error.body}`);
        console.error(`${error.reason}`);
        throw new Error(`Error deploying contract ${name}`);
    }
}

async function main() {
    const ZKE = await deployContract("ZKE", []);
    const setOwner = await ZKE.setGov(user1.address);
    await setOwner.wait();

    const secondOwner = await ZKE.setGov(user0.address);
    await secondOwner.wait();

    const prevOwner = await ZKE.gov();
    console.log(prevOwner);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })