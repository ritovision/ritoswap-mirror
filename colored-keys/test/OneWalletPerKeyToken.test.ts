// \colored-keys\test\OneWalletPerKeyToken.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { OnePerWalletKeyToken, MockERC721Receiver } from "../typechain-types";

// Type alias for signers – using any since the proper type isn't available
type SignerWithAddress = any;

interface Fixture {
  keyToken: OnePerWalletKeyToken;
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
  addr3: SignerWithAddress;
  addr4: SignerWithAddress;
}

async function deployOnePerWalletFixture(): Promise<Fixture> {
  const [owner, addr1, addr2, addr3, addr4] =
    // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
    await ethers.getSigners() as SignerWithAddress[];

  const factory = await ethers.getContractFactory("OnePerWalletKeyToken");
  const keyToken = (await factory.deploy()) as OnePerWalletKeyToken;
  await keyToken.waitForDeployment();

  return { keyToken, owner, addr1, addr2, addr3, addr4 };
}

describe("OnePerWalletKeyToken", function () {
  describe("One Token Per Wallet Restriction", function () {
    it("Should allow minting one token per wallet", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      expect(await keyToken.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should prevent minting second token to same wallet", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();

      await expect(keyToken.connect(addr1).mint())
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr1.address);
    });

    it("Should override mintBatch to only allow quantity of 1", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);

      await expect(keyToken.connect(addr1).mintBatch(2))
        .to.be.revertedWith("Can only mint 1 token due to one-per-wallet rule");
      await expect(keyToken.connect(addr1).mintBatch(10))
        .to.be.revertedWith("Can only mint 1 token due to one-per-wallet rule");
    });

    it("Should allow mintBatch with quantity 1", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mintBatch(1);

      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
    });
  });

  describe("Transfers with One Token Restriction", function () {
    it("Should allow transfer if recipient has no tokens", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1);

      expect(await keyToken.balanceOf(addr1.address)).to.equal(0);
      expect(await keyToken.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should prevent transfer if recipient already has a token", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      await expect(
        keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1)
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr2.address);
    });

    it("Should allow transferring token back to original owner", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      await keyToken.connect(addr2).transferFrom(addr2.address, addr1.address, 1);

      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      expect(await keyToken.balanceOf(addr2.address)).to.equal(0);
    });

    it("Should prevent safeTransfer if recipient already has a token", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      await expect(
        keyToken
          .connect(addr1)[
            "safeTransferFrom(address,address,uint256)"
          ](addr1.address, addr2.address, 1)
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr2.address);
    });

    it("Should allow safeTransferFrom with data payload when recipient empty", async () => {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      const data = ethers.toUtf8Bytes("0xdeadbeef");
      await expect(
        keyToken
          .connect(addr1)["safeTransferFrom(address,address,uint256,bytes)"](
            addr1.address, addr2.address, 1, data
          )
      ).to.not.be.reverted;
      expect(await keyToken.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should prevent safeTransferFrom with data if recipient already has token", async () => {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();
      const data = ethers.toUtf8Bytes("0xbeef");
      await expect(
        keyToken
          .connect(addr1)["safeTransferFrom(address,address,uint256,bytes)"](
            addr1.address, addr2.address, 1, data
          )
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr2.address);
    });

    it("Should allow transfer to self without changing balance", async () => {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await expect(
        keyToken.connect(addr1).transferFrom(addr1.address, addr1.address, 1)
      ).to.not.be.reverted;
      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should revert safeTransfer to contract receiver that already owns a token", async () => {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      const RF = await ethers.getContractFactory("MockERC721Receiver");
      const receiver = (await RF.deploy()) as MockERC721Receiver;
      await receiver.waitForDeployment();
      const receiverAddr = await receiver.getAddress();

      // addr1 → receiver
      await keyToken.connect(addr1).mint();
      await keyToken
        .connect(addr1)["safeTransferFrom(address,address,uint256)"](
          addr1.address, receiverAddr, 1
        );

      // addr2 → receiver (now has a token already)
      await keyToken.connect(addr2).mint();
      await expect(
        keyToken
          .connect(addr2)["safeTransferFrom(address,address,uint256)"](
            addr2.address, receiverAddr, 2
          )
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(receiverAddr);
    });
  });

  describe("getTokenOfOwner Helper", function () {
    it("Should return token ID and true for owner with token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();

      const [tokenId, hasToken] = await keyToken.getTokenOfOwner(addr1.address);
      expect(tokenId).to.equal(1n);
      expect(hasToken).to.be.true;
    });

    it("Should return 0 and false for owner without token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);

      const [tokenId, hasToken] = await keyToken.getTokenOfOwner(addr1.address);
      expect(tokenId).to.equal(0n);
      expect(hasToken).to.be.false;
    });

    it("Should track correct token after transfers", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();

      const [tokenId1, hasToken1] = await keyToken.getTokenOfOwner(addr1.address);
      expect(tokenId1).to.equal(1n);
      expect(hasToken1).to.be.true;

      await keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1);

      const [tokenId2, hasToken2] = await keyToken.getTokenOfOwner(addr1.address);
      expect(tokenId2).to.equal(0n);
      expect(hasToken2).to.be.false;

      const [tokenId3, hasToken3] = await keyToken.getTokenOfOwner(addr2.address);
      expect(tokenId3).to.equal(1n);
      expect(hasToken3).to.be.true;
    });

    it("getTokenOfOwner returns (0,false) once burned", async () => {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).burn(1);

      const [id, has] = await keyToken.getTokenOfOwner(addr1.address);
      expect(id).to.equal(0n);
      expect(has).to.be.false;
    });
  });

  describe("Burning with One Token Restriction", function () {
    it("Should allow burning and then minting new token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployOnePerWalletFixture);
      await keyToken.connect(addr1).mint();
      expect(await keyToken.ownerOf(1)).to.equal(addr1.address);

      await keyToken.connect(addr1).burn(1);
      expect(await keyToken.balanceOf(addr1.address)).to.equal(0);

      await keyToken.connect(addr1).mint();
      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      expect(await keyToken.ownerOf(2)).to.equal(addr1.address);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle multiple users minting and transferring", async function () {
      const { keyToken, addr1, addr2, addr3, addr4 } =
        await loadFixture(deployOnePerWalletFixture);

      // Everyone mints
      await keyToken.connect(addr1).mint(); // 1
      await keyToken.connect(addr2).mint(); // 2
      await keyToken.connect(addr3).mint(); // 3

      // addr1 → addr4
      await keyToken.connect(addr1).transferFrom(addr1.address, addr4.address, 1);
      // addr1 can mint again
      await keyToken.connect(addr1).mint(); // 4

      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      expect(await keyToken.balanceOf(addr2.address)).to.equal(1);
      expect(await keyToken.balanceOf(addr3.address)).to.equal(1);
      expect(await keyToken.balanceOf(addr4.address)).to.equal(1);

      expect(await keyToken.ownerOf(4)).to.equal(addr1.address);
      expect(await keyToken.ownerOf(1)).to.equal(addr4.address);
    });

    it("Should properly track token through a transfer chain", async function () {
      const { keyToken, addr1, addr2, addr3 } =
        await loadFixture(deployOnePerWalletFixture);

      await keyToken.connect(addr1).mint(); // 1
      await keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      await keyToken.connect(addr2).transferFrom(addr2.address, addr3.address, 1);
      await keyToken.connect(addr3).transferFrom(addr3.address, addr1.address, 1);

      const [tokenId, hasToken] = await keyToken.getTokenOfOwner(addr1.address);
      expect(tokenId).to.equal(1n);
      expect(hasToken).to.be.true;
    });
  });

  describe("Approvals with One Token Restriction", function () {
    it("Should prevent approved transfer if recipient has token", async function () {
      const { keyToken, addr1, addr2, addr3 } =
        await loadFixture(deployOnePerWalletFixture);

      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();
      await keyToken.connect(addr1).approve(addr3.address, 1);

      await expect(
        keyToken.connect(addr3).transferFrom(addr1.address, addr2.address, 1)
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr2.address);
    });

    it("Should allow setApprovalForAll but still enforce one token rule", async function () {
      const { keyToken, addr1, addr2, addr3 } =
        await loadFixture(deployOnePerWalletFixture);

      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();
      await keyToken.connect(addr1).setApprovalForAll(addr3.address, true);

      await expect(
        keyToken.connect(addr3).transferFrom(addr1.address, addr2.address, 1)
      )
        .to.be.revertedWithCustomError(keyToken, "WouldExceedMaxTokensPerWallet")
        .withArgs(addr2.address);
    });
  });
});