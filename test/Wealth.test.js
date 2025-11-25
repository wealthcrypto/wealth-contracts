const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Wealth", function () {
async function deployToken() {
  const [deployer, privatesale, presale, listing, marketing, operation, teamAlloc, reserve, other] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("Wealth");
  const token = await Token.deploy(
    privatesale.address,
    presale.address,
    listing.address,
    marketing.address,
    operation.address,
    teamAlloc.address,
    reserve.address
  );
  await token.waitForDeployment();
  return { token, deployer, privatesale, presale, listing, marketing, operation, teamAlloc, reserve, other };
}

  it("distributes max supply to predefined wallets with correct percentages", async function () {
    const { token, privatesale, presale, listing, marketing, operation, teamAlloc, reserve } = await deployToken();
    const maxSupply = ethers.parseUnits("1800000", 18);

    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(maxSupply);

    const pct = (v) => (maxSupply * BigInt(v)) / 100n;
    const balances = await Promise.all([
      token.balanceOf(privatesale.address),
      token.balanceOf(presale.address),
      token.balanceOf(listing.address),
      token.balanceOf(marketing.address),
      token.balanceOf(operation.address),
      token.balanceOf(teamAlloc.address),
      token.balanceOf(reserve.address),
    ]);

    expect(balances[0]).to.equal(pct(10));
    expect(balances[1]).to.equal(pct(20));
    expect(balances[2]).to.equal(pct(20));
    expect(balances[3]).to.equal(pct(10));
    expect(balances[4]).to.equal(pct(5));
    expect(balances[5]).to.equal(pct(5));
    expect(balances[6]).to.equal(pct(30));

    const sum = balances.reduce((acc, v) => acc + v, 0n);
    expect(sum).to.equal(maxSupply);
  });

  it("exposes no public mint function (including admin)", async function () {
    const { token } = await deployToken();

    // No public mint function in the ABI
    const hasMint = token.interface.fragments.some(
      (f) => f.type === "function" && f.name === "mint"
    );
    expect(hasMint).to.equal(false);

    // token.mint should be undefined
    expect(token.mint).to.equal(undefined);

    // Ensure a raw call to the mint selector reverts (function does not exist)
    const i = new ethers.Interface(["function mint(address to, uint256 amount)"]);
    const data = i.encodeFunctionData("mint", [token.target, 1n]);
    await expect(
      (await ethers.getSigners())[0].sendTransaction({ to: token.target, data })
    ).to.be.reverted;
  });

  it("only owner can burn, and burn reduces owner balance and total supply", async function () {
    const { token, deployer, privatesale } = await deployToken();

    const amount = ethers.parseUnits("10", 18);

    await expect(token.connect(privatesale).burn(amount)).to.be.revertedWith("Not owner");

    await token.connect(privatesale).transfer(deployer.address, amount);

    const supplyBefore = await token.totalSupply();
    const ownerBefore = await token.balanceOf(deployer.address);
    await token.connect(deployer).burn(amount);
    const supplyAfter = await token.totalSupply();
    const ownerAfter = await token.balanceOf(deployer.address);

    expect(ownerBefore - ownerAfter).to.equal(amount);
    expect(supplyBefore - supplyAfter).to.equal(amount);
  });

  it("direct transfer moves balance from sender to recipient", async function () {
    const { token, privatesale, other } = await deployToken();

    const amount = ethers.parseUnits("100", 18);

    const senderBefore = await token.balanceOf(privatesale.address);
    const recipientBefore = await token.balanceOf(other.address);

    await expect(
      token.connect(privatesale).transfer(other.address, amount)
    )
      .to.emit(token, "Transfer")
      .withArgs(privatesale.address, other.address, amount);

    const senderAfter = await token.balanceOf(privatesale.address);
    const recipientAfter = await token.balanceOf(other.address);

    expect(senderBefore - senderAfter).to.equal(amount);
    expect(recipientAfter - recipientBefore).to.equal(amount);
  });

  it("transfer via allowance: approve then transferFrom and allowance decreases", async function () {
    const { token, presale, deployer, other } = await deployToken();

    const amount = ethers.parseUnits("250", 18);

    await expect(
      token.connect(presale).approve(other.address, amount)
    )
      .to.emit(token, "Approval")
      .withArgs(presale.address, other.address, amount);

    const allowanceBefore = await token.allowance(presale.address, other.address);
    expect(allowanceBefore).to.equal(amount);

    const ownerBefore = await token.balanceOf(presale.address);
    const recipientBefore = await token.balanceOf(deployer.address);

    await expect(
      token.connect(other).transferFrom(presale.address, deployer.address, amount)
    )
      .to.emit(token, "Transfer")
      .withArgs(presale.address, deployer.address, amount);

    const ownerAfter = await token.balanceOf(presale.address);
    const recipientAfter = await token.balanceOf(deployer.address);
    const allowanceAfter = await token.allowance(presale.address, other.address);

    expect(ownerBefore - ownerAfter).to.equal(amount);
    expect(recipientAfter - recipientBefore).to.equal(amount);
    expect(allowanceAfter).to.equal(0n);
  });

  it("transferOwnership updates OWNER and only new owner can burn", async function () {
    const { token, deployer, privatesale, other } = await deployToken();

    const amount = ethers.parseUnits("5", 18);

    await expect(
      token.connect(privatesale).transferOwnership(other.address)
    ).to.be.revertedWith("Not owner");

    const ownerBeforeRole = await token.OWNER();
    expect(ownerBeforeRole).to.equal(deployer.address);

    await expect(
      token.connect(deployer).transferOwnership(other.address)
    )
      .to.emit(token, "OwnershipTransferred")
      .withArgs(deployer.address, other.address);

    const ownerAfterRole = await token.OWNER();
    expect(ownerAfterRole).to.equal(other.address);

    await token.connect(privatesale).transfer(other.address, amount);

    await expect(token.connect(deployer).burn(amount)).to.be.revertedWith("Not owner");

    const supplyBefore = await token.totalSupply();
    await token.connect(other).burn(amount);
    const supplyAfter = await token.totalSupply();
    expect(supplyBefore - supplyAfter).to.equal(amount);
  });

  it("renounceOwnership sets OWNER to zero and disables owner-only actions", async function () {
    const { token, deployer, privatesale } = await deployToken();

    await expect(token.connect(privatesale).renounceOwnership()).to.be.revertedWith("Not owner");

    await expect(
      token.connect(deployer).renounceOwnership()
    )
      .to.emit(token, "OwnershipTransferred")
      .withArgs(deployer.address, ethers.ZeroAddress);

    const ownerRole = await token.OWNER();
    expect(ownerRole).to.equal(ethers.ZeroAddress);

    await expect(token.connect(deployer).burn(1n)).to.be.revertedWith("Not owner");
  });
});