require("@nomiclabs/hardhat-etherscan")
require("hardhat-contract-sizer")
require('@typechain/hardhat')
require('@matterlabs/hardhat-zksync-toolbox')
require("@nomiclabs/hardhat-waffle")
const dotenv = require("dotenv");

dotenv.config();
// const IS_ZK_NETWORK = process.env.IS_ZK_NETWORK;
// if(!IS_ZK_NETWORK) {
//   require("@nomiclabs/hardhat-waffle")
// }

// const {
//   BSC_URL,
//   BSC_DEPLOY_KEY,
//   BSCSCAN_API_KEY,
//   POLYGONSCAN_API_KEY,
//   SNOWTRACE_API_KEY,
//   ARBISCAN_API_KEY,
//   ETHERSCAN_API_KEY,
//   BSC_TESTNET_URL,
//   BSC_TESTNET_DEPLOY_KEY,
//   ARBITRUM_TESTNET_DEPLOY_KEY,
//   ARBITRUM_TESTNET_URL,
//   ARBITRUM_DEPLOY_KEY,
//   ARBITRUM_URL,
//   AVAX_DEPLOY_KEY,
//   AVAX_URL,
//   POLYGON_DEPLOY_KEY,
//   POLYGON_URL,
//   MAINNET_URL,
//   MAINNET_DEPLOY_KEY
// } = require("./env.json")

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async () => {
//   const accounts = await ethers.getSigners()

//   for (const account of accounts) {
//     console.info(account.address)
//   }
// })

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    localhost: {
      timeout: 120000
    },
    zkSyncDocker: {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    },
    zkTeamServer: {
      url: "http://45.76.38.228:3050",
      ethNetwork: "http://45.76.38.228:8545",
      zksync: true,
    },
    zkSyncTestnet: {
      url: "https://testnet.era.zksync.dev",
      ethNetwork: "https://eth-goerli.public.blastapi.io",
      zksync: true,
    },
    hardhat: {
      zksync: true,  // enables zksync in hardhat local network,
      allowUnlimitedContractSize: true
    }
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10
      }
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  // paths: {
  //   tests: "./test/core/Vault", // Replace 'my-test-folder' with the name of the folder you prefer
  // },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: false,
  },
  zksolc: {
    version: "1.3.8",
    compilerSource: "binary",  // binary or docker (deprecated)
    settings: {
      // compilerPath: "zksolc",  // optional. Ignored for compilerSource "docker". Can be used if compiler is located in a specific folder
      libraries:{}, // optional. References to non-inlinable libraries
      optimizer: {
        enabled: false, // optional. True by default
        mode: 'z' // optional. 3 by default, z to optimize bytecode size
      } 
    }
  }
}
