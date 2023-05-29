const { ethers } = require('ethers');
const { Wallet, Contract, utils, Provider } = require('zksync-web3');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');
const hre = require('hardhat');
const { accounts } = require("../shared/accounts");
const { parseEther } = require('ethers/lib/utils');

//const privateKeyGovernor = "" //0x74760239448BA8bD5F40f14b417f3b137734e635
const provider = new Provider(hre.network.config.url);


// console.log("hre.network ", hre.network)
// console.log("provider.network.name ", provider)
const [wallet, user0, user1, user2, user3] = accounts.map(account => new Wallet(account.privateKey, provider));
const governor = new Wallet(privateKeyGovernor, provider);
const deployer = new Deployer(hre, governor);

async function deployContract(name, args, deployer, options) {
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

async function sendTx(tx, label) {
    try {
        console.info(`sending ${label}...`)
        const txn = await tx;
        console.info(`txn: ${txn}\n`)
        const receipt = await txn.wait();
        console.info(`completed: ${txn}\n`)
        return receipt
    } catch (error) {
        console.error(`${error.code}`);
        console.error(`${error.body}`);
        console.error(`${error.reason}`);
        throw new Error(`Error sending ${label}`);
    }
}

const ZkeAbi = require("../../../artifacts-zk/contracts/zke/ZKE.sol/ZKE.json").abi
const IErc20Abi = require("../../../artifacts-zk/contracts/libraries/token/IERC20.sol/IERC20.json").abi
const MigrateVestingAbi = require("../../../artifacts-zk/contracts/vesting/MigrateVesting.sol/MigrateVesting.json").abi

async function main() {
    /*  
        IERC20 _zke,
        IERC20 _usdc,
        uint256 _vestingWeeks,
        uint256 _tokenPrice,
        uint256 _maxZkeVesting,
        uint256 _vestingStart
    */ 
        let args = [
            // "0x7b3e1236c39ddD2e61cF6Da6ac6D11193238ccB0",//ZKE zkEra,
            // "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4",//USDC zkEra,
            78, //weeks
            200000, //price
            ethers.utils.parseEther("5000000"), //maxPurchase
            1683277200, //05.05.2023 12:00:00 UTC
            "0xefe3e7D0A978de409055dFbc3Df7F05357B2CeeD" //WeeklyVesting Option 2
        ]
        console.log("deploy MigrateVesting (Migrate from option 2)")
        const migrateVesting = await deployContract("MigrateVesting", [...args], deployer)
        console.log("MigrateVesting verification")
        await hre.run("verify:verify", {
            address: migrateVesting.address,//,
            // contract: "WeeklyVesting",
            constructorArguments: args
        });
}       

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
