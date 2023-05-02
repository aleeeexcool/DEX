const { ethers } = require('ethers');
const { Wallet, Contract, utils, Provider } = require('zksync-web3');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');
const hre = require('hardhat');
const { accounts } = require("../shared/accounts");
const { parseEther } = require('ethers/lib/utils');

// const privateKeyGovernor = //0x74760239448BA8bD5F40f14b417f3b137734e635
const provider = new Provider(hre.network.config.url);


// console.log("hre.network ", hre.network)
// console.log("provider.network.name ", provider)
const [wallet, user0, user1, user2, user3] = accounts.map(account => new Wallet(account.privateKey, provider));
const governor = new Wallet(privateKeyGovernor, provider);
const deployer = new Deployer(hre, governor);

async function deployContract(name, args, deployer, options) {
    try {
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
const WeeklyVestingAbi = require("../../../artifacts-zk/contracts/vesting/WeeklyVesting.sol/WeeklyVesting.json").abi
// const { ZKEArtifact } = require()

async function main() {
    // const deployerWallet = new Wallet(privateKeyGovernor, provider)
    
    // const zke = await deployContract("ZKE", [], deployer)
    // const usdcMock = await deployContract("UsdcMock", [], deployer)
    /*  
        IERC20 _zke,
        IERC20 _usdc,
        uint256 _vestingWeeks,
        uint256 _tokenPrice,
        uint256 _maxZkeVesting,
        uint256 _vestingStart
    */ 
        let args = [
            "0x7b3e1236c39ddD2e61cF6Da6ac6D11193238ccB0",//ZKE zkEra,
            "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4",//USDC zkEra,
            78, 
            200000,
            ethers.utils.parseEther("5000000"),
            1683277200 //05.05.2023 12:00:00 UTC
        ]
        console.log("OPTION 3")
        const weeklyVesting = await deployContract("WeeklyVesting", [...args], deployer)
        console.log("OPTION 3 verification")
        await hre.run("verify:verify", {
            address: weeklyVesting.address,//,
            // contract: "WeeklyVesting",
            constructorArguments: args
          });
        ////////////////////////////////////////////////////////////////////////////////////////////
        // const herman = "0x3704bd27db79ED6ca94a83Ca64f256697DdFE9A9" //Herman
        // const leha = "0x196746a83FEE9336aa34D41E1d6CBEFE870B8eF2" //Leha
        // const zke = new Contract("0x31a8C7222f5121A9DBB2865Ba302b00bB7809c28", ZkeAbi, wallet)
        // const usdcMock = new Contract("0x8a544924916dCf0f73564750CBC68BBC65Fe1E0B", IErc20Abi, wallet)
        // const weeklyVesting = new Contract("0x4f86926CD4dEb46aD6281ee48660c2634405a3B0", WeeklyVestingAbi, wallet)
        
        // let balanceLeha = await usdcMock.balanceOf(leha);
        // let balanceHerman = await usdcMock.balanceOf(herman);
        // let balanceAndrii = await wallet.getBalance(usdcMock.address)//await usdcMock.balanceOf(wallet.address);
        // console.log(`leha usdc balance: ${balanceLeha.toString()}`)
        // console.log(`herman usdc balance: ${balanceHerman.toString()}`)
        // console.log(`my usdc balance: ${balanceAndrii.toString()}`)
        // await sendTx(wallet.transfer({to: leha, amount: parseEther("50")})) //done
        // await sendTx(wallet.transfer({to: herman, amount: parseEther("50")})) //done
        // // await usdcMock.transfer(leha, 10000000000);
        // // await usdcMock.transfer(herman, 10000000000);
        // // await zke.transfer(weeklyVesting.address, parseEther("1500000"));
        // await wallet.transfer({to: leha, amount: 10000000000, token: usdcMock.address}) //10 000 usdc
        // await wallet.transfer({to: herman, amount: 10000000000, token: usdcMock.address}) //10 000 usdc
        // await wallet.transfer({to: weeklyVesting.address, amount: parseEther("1500000"), token: zke.address}) //10 000 usdc
        // balanceLeha = await usdcMock.balanceOf(leha);
        // balanceHerman = await usdcMock.balanceOf(herman);
        // balanceAndrii = await wallet.getBalance(usdcMock.address)//await usdcMock.balanceOf(wallet.address);
        // console.log(`leha usdc balance after: ${balanceLeha.toString()}`)
        // console.log(`herman usdc balance after: ${balanceHerman.toString()}`)
        // console.log(`my usdc balance after: ${balanceAndrii.toString()}`)
}       

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
