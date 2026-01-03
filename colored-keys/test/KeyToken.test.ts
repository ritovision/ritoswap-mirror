// \colored-keys\test\KeyToken.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { KeyToken, MockERC721Receiver } from "../typechain-types";
import { Buffer } from "buffer";

// Type alias for signers - using any since the proper type isn't available
type SignerWithAddress = any;

interface Fixture {
  keyToken: KeyToken;
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
  addr3: SignerWithAddress;
}

async function deployKeyTokenFixture(): Promise<Fixture> {
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [owner, addr1, addr2, addr3] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("KeyToken");
  const keyToken = (await factory.deploy()) as KeyToken;
  await keyToken.waitForDeployment();
  return { keyToken, owner, addr1, addr2, addr3 };
}

describe("KeyToken", function () {
  describe("Deployment", function () {
    it("Should set the right token name and symbol", async function () {
      const { keyToken } = await loadFixture(deployKeyTokenFixture);
      expect(await keyToken.name()).to.equal("Colored Keys");
      expect(await keyToken.symbol()).to.equal("CKEY");
    });

    it("Should start with total supply of 0", async function () {
      const { keyToken } = await loadFixture(deployKeyTokenFixture);
      expect(await keyToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should mint a single token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      expect(await keyToken.ownerOf(1)).to.equal(addr1.address);
      expect(await keyToken.totalSupply()).to.equal(1);
    });

    it("Should mint with sequential token IDs", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      expect(await keyToken.ownerOf(1)).to.equal(addr1.address);
      expect(await keyToken.ownerOf(2)).to.equal(addr2.address);
    });

    it("Should store color data for each token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const [bgColor, keyColor] = await keyToken.getTokenColors(1);
      expect(bgColor).to.match(/^#[0-9a-f]{6}$/);
      expect(keyColor).to.match(/^#[0-9a-f]{6}$/);
      expect(bgColor).to.not.equal(keyColor);
    });

    it("Should emit Transfer event on mint", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await expect(keyToken.connect(addr1).mint())
        .to.emit(keyToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 1);
    });
  });

  describe("Batch Minting", function () {
    it("Should mint multiple tokens in batch", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);

      expect(await keyToken.balanceOf(addr1.address)).to.equal(3);
      expect(await keyToken.totalSupply()).to.equal(3);
    });

    it("Should reject batch mint with 0 quantity", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await expect(keyToken.connect(addr1).mintBatch(0))
        .to.be.revertedWith("Quantity must be between 1 and 10");
    });

    it("Should reject batch mint with quantity > 10", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await expect(keyToken.connect(addr1).mintBatch(11))
        .to.be.revertedWith("Quantity must be between 1 and 10");
    });

    it("Should mint correct sequential IDs in batch", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);

      const tokens = await keyToken.tokensOfOwner(addr1.address);
      expect(tokens).to.deep.equal([1n, 2n, 3n]);
    });
  });

  describe("Token URI and Metadata", function () {
    it("Should return valid base64 encoded JSON", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      const tokenURI = await keyToken.tokenURI(1);

      expect(tokenURI).to.match(/^data:application\/json;base64,/);

      const base64Data = tokenURI.split(",")[1];
      const jsonString = Buffer.from(base64Data, "base64").toString();
      const metadata = JSON.parse(jsonString);

      expect(metadata.name).to.equal("Colored Key #1");
      expect(metadata.description).to.include("fully on-chain key");
      expect(metadata.image).to.match(/^data:image\/svg\+xml;base64,/);
      expect(metadata.attributes).to.have.lengthOf(4);
    });

    it("Should include correct attributes", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      const tokenURI = await keyToken.tokenURI(1);

      const base64Data = tokenURI.split(",")[1];
      const metadata = JSON.parse(Buffer.from(base64Data, "base64").toString());

      const [bgAttr, keyAttr, minterAttr, timeAttr] = metadata.attributes;
      expect(bgAttr.trait_type).to.equal("Background Color");
      expect(keyAttr.trait_type).to.equal("Key Color");
      expect(minterAttr.trait_type).to.equal("Minter");
      expect(timeAttr.trait_type).to.equal("Minted At");
      expect(minterAttr.value.toLowerCase()).to.equal(addr1.address.toLowerCase());
    });

    it("Should render valid SVG", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      const tokenURI = await keyToken.tokenURI(1);

      const metadata = JSON.parse(
        Buffer.from(tokenURI.split(",")[1], "base64").toString()
      );
      const svg = Buffer.from(metadata.image.split(",")[1], "base64").toString();

      expect(svg).to.include('<svg viewBox="0 0 200 200"');
      expect(svg).to.include("<circle");
      expect(svg).to.include("<rect");
      expect(svg).to.include("<path");
    });

    it("Should revert for non-existent token", async function () {
      const { keyToken } = await loadFixture(deployKeyTokenFixture);
      await expect(keyToken.tokenURI(999))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });

    it("tokenURI is stable across multiple calls", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      const uri1 = await keyToken.tokenURI(1);
      const uri2 = await keyToken.tokenURI(1);
      expect(uri1).to.equal(uri2);
    });
  });

  describe("Token Enumeration", function () {
    it("tokensOfOwner returns empty array if no tokens", async function () {
      const { keyToken, addr3 } = await loadFixture(deployKeyTokenFixture);
      expect(await keyToken.tokensOfOwner(addr3.address)).to.deep.equal([]);
    });

    it("Should track tokens of owner correctly", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);
      await keyToken.connect(addr2).mint();

      expect(await keyToken.tokensOfOwner(addr1.address)).to.deep.equal([1n, 2n, 3n]);
      expect(await keyToken.tokensOfOwner(addr2.address)).to.deep.equal([4n]);
    });

    it("Should update enumeration after transfer", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).transferFrom(addr1.address, addr2.address, 1);

      expect(await keyToken.tokensOfOwner(addr1.address)).to.deep.equal([]);
      expect(await keyToken.tokensOfOwner(addr2.address)).to.deep.equal([1n]);
    });

    it("Should track total supply correctly", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(5);
      expect(await keyToken.totalSupply()).to.equal(5);

      await keyToken.connect(addr1).burn(3);
      expect(await keyToken.totalSupply()).to.equal(4);
    });

    it("tokensOfOwner updates correctly when burning a middle token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3); // IDs 1,2,3
      await keyToken.connect(addr1).burn(2);
      expect(await keyToken.tokensOfOwner(addr1.address)).to.deep.equal([1n, 3n]);
    });

    it("tokenOfOwnerByIndex reverts when index >= balance", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await expect(
        keyToken.tokenOfOwnerByIndex(addr1.address, 1)
      ).to.be.revertedWithCustomError(keyToken, "ERC721OutOfBoundsIndex");
    });
  });

  describe("Burning", function () {
    it("Should allow owner to burn their token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).burn(1);

      expect(await keyToken.balanceOf(addr1.address)).to.equal(0);
      await expect(keyToken.ownerOf(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });

    it("Should not allow non-owner to burn token", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await expect(keyToken.connect(addr2).burn(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721InsufficientApproval");
    });

    it("Should allow approved address to burn token", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).approve(addr2.address, 1);
      await keyToken.connect(addr2).burn(1);

      await expect(keyToken.ownerOf(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });

    it("Should allow operator-approved address to burn token", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).setApprovalForAll(addr2.address, true);
      await expect(keyToken.connect(addr2).burn(1)).to.not.be.reverted;
      await expect(keyToken.ownerOf(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });
  });

  describe("Color Generation", function () {
    it("Should generate different colors for different tokens", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);

      const [bg1, key1] = await keyToken.getTokenColors(1);
      const [bg2, key2] = await keyToken.getTokenColors(2);
      const [bg3, key3] = await keyToken.getTokenColors(3);

      expect(bg1).to.not.equal(bg2);
      expect(bg2).to.not.equal(bg3);
      expect(key1).to.not.equal(key2);
      expect(key2).to.not.equal(key3);
    });

    it("Should generate different colors for same token ID from different minters", async function () {
      const { addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      const factory = await ethers.getContractFactory("KeyToken");

      const kt1 = (await factory.deploy()) as KeyToken;
      await kt1.waitForDeployment();
      const kt2 = (await factory.deploy()) as KeyToken;
      await kt2.waitForDeployment();

      await kt1.connect(addr1).mint();
      await kt2.connect(addr2).mint();

      const [bg1, key1] = await kt1.getTokenColors(1);
      const [bg2, key2] = await kt2.getTokenColors(1);

      expect(bg1).to.not.equal(bg2);
      expect(key1).to.not.equal(key2);
    });
  });

  describe("Internal Function Coverage", function () {
    it("Should trigger _update via safeTransferFrom", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1)["safeTransferFrom(address,address,uint256)"](
        addr1.address, addr2.address, 1
      );
      expect(await keyToken.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should trigger _update with data overload", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      const data = ethers.toUtf8Bytes("data");
      await keyToken.connect(addr1)["safeTransferFrom(address,address,uint256,bytes)"](
        addr1.address, addr2.address, 1, data
      );
      expect(await keyToken.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should trigger _increaseBalance on repeated mints", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      expect(await keyToken.balanceOf(addr1.address)).to.equal(1);
      await keyToken.connect(addr1).mint();
      expect(await keyToken.balanceOf(addr1.address)).to.equal(2);
      await keyToken.connect(addr1).mintBatch(3);
      expect(await keyToken.balanceOf(addr1.address)).to.equal(5);
    });

    it("Should handle operator-approved transfers", async function () {
      const { keyToken, addr1, addr2, addr3 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);
      await keyToken.connect(addr1).setApprovalForAll(addr2.address, true);
      await keyToken.connect(addr2).transferFrom(addr1.address, addr3.address, 1);
      await keyToken.connect(addr2).transferFrom(addr1.address, addr3.address, 2);
      expect(await keyToken.balanceOf(addr3.address)).to.equal(2);
    });

    it("Should exercise enumeration getters & burn path", async function () {
      const { keyToken, addr1, addr2, addr3 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);
      await keyToken.connect(addr2).mintBatch(2);

      expect(await keyToken.tokenOfOwnerByIndex(addr1.address, 0)).to.equal(1);
      expect(await keyToken.tokenByIndex(4)).to.equal(5);

      await keyToken.connect(addr1).transferFrom(addr1.address, addr3.address, 2);
      expect(await keyToken.tokenOfOwnerByIndex(addr1.address, 1)).to.equal(3);

      await keyToken.connect(addr3).burn(2);
      expect(await keyToken.totalSupply()).to.equal(4);
    });
  });

  describe("Edge Cases for Full Coverage", function () {
    it("Should safeTransfer to a contract receiver", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      const rf = await ethers.getContractFactory("MockERC721Receiver");
      const receiver = (await rf.deploy()) as MockERC721Receiver;
      await receiver.waitForDeployment();

      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1)["safeTransferFrom(address,address,uint256)"](
        addr1.address,
        await receiver.getAddress(),
        1
      );
      expect(await keyToken.ownerOf(1)).to.equal(await receiver.getAddress());
    });

    it("Should clear approval on transfer", async function () {
      const { keyToken, addr1, addr2, addr3 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).approve(addr2.address, 1);
      expect(await keyToken.getApproved(1)).to.equal(addr2.address);
      await keyToken.connect(addr1).transferFrom(addr1.address, addr3.address, 1);
      expect(await keyToken.getApproved(1)).to.equal(ethers.ZeroAddress);
    });

    it("Should mint after burning last token", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).burn(1);
      expect(await keyToken.totalSupply()).to.equal(0);
      await keyToken.connect(addr1).mint();
      expect(await keyToken.ownerOf(2)).to.equal(addr1.address);
    });

    it("Should handle zero-address in updates", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr1).burn(1);
      await expect(keyToken.ownerOf(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });

    it("Should enforce tokenByIndex bounds", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await expect(keyToken.tokenByIndex(0))
        .to.be.revertedWithCustomError(keyToken, "ERC721OutOfBoundsIndex");
      await keyToken.connect(addr1).mint();
      expect(await keyToken.tokenByIndex(0)).to.equal(1);
      await expect(keyToken.tokenByIndex(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721OutOfBoundsIndex");
    });

    it("Should support ERC721Metadata interface", async function () {
      const { keyToken } = await loadFixture(deployKeyTokenFixture);
      expect(await keyToken.supportsInterface("0x5b5e139f")).to.be.true;
    });

    it("Should revert when safeTransferring to contract without ERC721Receiver", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      const badReceiverFactory = await ethers.getContractFactory("BadERC721Receiver");
      const badReceiver = await badReceiverFactory.deploy();
      await badReceiver.waitForDeployment();

      await keyToken.connect(addr1).mint();
      await expect(
        keyToken.connect(addr1)["safeTransferFrom(address,address,uint256)"](
          addr1.address,
          await badReceiver.getAddress(),
          1
        )
      ).to.be.revertedWithCustomError(keyToken, "ERC721InvalidReceiver");
    });

    it("Should check supportsInterface coverage", async function () {
      const { keyToken } = await loadFixture(deployKeyTokenFixture);
      // Test ERC721 interface
      expect(await keyToken.supportsInterface("0x80ac58cd")).to.be.true;
      // Test ERC721Enumerable interface
      expect(await keyToken.supportsInterface("0x780e9d63")).to.be.true;
      // Test invalid interface
      expect(await keyToken.supportsInterface("0x12345678")).to.be.false;
    });

    it("Should exercise _update function through direct burn", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      // This should trigger the _update function with 'to' as zero address
      await keyToken.connect(addr1).burn(1);

      // Verify the token is burned
      await expect(keyToken.ownerOf(1))
        .to.be.revertedWithCustomError(keyToken, "ERC721NonexistentToken");
    });
  });
});