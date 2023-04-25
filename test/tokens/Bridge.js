const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract, deployVault } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed } = require("../shared/utilities")

use(solidity)

describe("Bridge", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
  let zke
  let wzke
  let bridge

  beforeEach(async () => {
    zke = await deployContract("ZKE", [])
    wzke = await deployContract("ZKE", [])
    bridge = await deployContract("Bridge", [zke.address, wzke.address])
  })

  it("wrap, unwrap", async () => {
    await zke.setMinter(wallet.address, true)
    await zke.mint(user0.address, 100)
    await zke.connect(user0).approve(bridge.address, 100)
    await expect(bridge.connect(user0).wrap(200, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds allowance")

    await expect(bridge.connect(user0).wrap(100, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await wzke.setMinter(wallet.address, true)
    await wzke.mint(bridge.address, 50)

    await expect(bridge.connect(user0).wrap(100, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await wzke.mint(bridge.address, 50)

    expect(await zke.balanceOf(user0.address)).eq(100)
    expect(await zke.balanceOf(bridge.address)).eq(0)
    expect(await wzke.balanceOf(user1.address)).eq(0)
    expect(await wzke.balanceOf(bridge.address)).eq(100)

    await bridge.connect(user0).wrap(100, user1.address)

    expect(await zke.balanceOf(user0.address)).eq(0)
    expect(await zke.balanceOf(bridge.address)).eq(100)
    expect(await wzke.balanceOf(user1.address)).eq(100)
    expect(await wzke.balanceOf(bridge.address)).eq(0)

    await wzke.connect(user1).approve(bridge.address, 100)

    expect(await zke.balanceOf(user2.address)).eq(0)
    expect(await zke.balanceOf(bridge.address)).eq(100)
    expect(await wzke.balanceOf(user1.address)).eq(100)
    expect(await wzke.balanceOf(bridge.address)).eq(0)

    await bridge.connect(user1).unwrap(100, user2.address)

    expect(await zke.balanceOf(user2.address)).eq(100)
    expect(await zke.balanceOf(bridge.address)).eq(0)
    expect(await wzke.balanceOf(user1.address)).eq(0)
    expect(await wzke.balanceOf(bridge.address)).eq(100)
  })

  it("withdrawToken", async () => {
    await zke.setMinter(wallet.address, true)
    await zke.mint(bridge.address, 100)

    await expect(bridge.connect(user0).withdrawToken(zke.address, user1.address, 100))
      .to.be.revertedWith("Governable: forbidden")

    await expect(bridge.connect(user0).setGov(user0.address))
      .to.be.revertedWith("Governable: forbidden")

    await bridge.connect(wallet).setGov(user0.address)

    expect(await zke.balanceOf(user1.address)).eq(0)
    expect(await zke.balanceOf(bridge.address)).eq(100)
    await bridge.connect(user0).withdrawToken(zke.address, user1.address, 100)
    expect(await zke.balanceOf(user1.address)).eq(100)
    expect(await zke.balanceOf(bridge.address)).eq(0)
  })
})
