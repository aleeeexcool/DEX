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

module.exports = {
    deployContract
}