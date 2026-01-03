// colored-keys\test\Libraries.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { KeyToken } from "../typechain-types";
import { Buffer } from "buffer";

// Type alias for signers – using any since the proper type isn't available
type SignerWithAddress = any;

interface Fixture {
  keyToken: KeyToken;
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
}

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

/**
 * Deploys KeyToken and returns it plus three signers.
 */
async function deployKeyTokenFixture(): Promise<Fixture> {
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [owner, addr1, addr2] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("KeyToken");
  const keyToken = (await factory.deploy()) as KeyToken;
  await keyToken.waitForDeployment();
  return { keyToken, owner, addr1, addr2 };
}

/** Decode on-chain JSON metadata from a data URI */
function parseMetadata(uri: string): TokenMetadata {
  const payload = uri.replace(/^data:application\/json;base64,/, "");
  return JSON.parse(Buffer.from(payload, "base64").toString());
}

/** Decode embedded SVG XML from the metadata.image field */
function extractSvg(metadata: TokenMetadata): string {
  const payload = metadata.image.replace(/^data:image\/svg\+xml;base64,/, "");
  return Buffer.from(payload, "base64").toString();
}

describe("Libraries", function () {
  describe("ColorGenerator Library (via KeyToken)", function () {
    it("Should generate valid hex color format", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const [bgColor, keyColor] = await keyToken.getTokenColors(1);
      expect(bgColor).to.match(/^#[0-9a-f]{6}$/);
      expect(keyColor).to.match(/^#[0-9a-f]{6}$/);
    });

    it("Should generate different colors for different inputs", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      const [bg1, key1] = await keyToken.getTokenColors(1);
      const [bg2, key2] = await keyToken.getTokenColors(2);

      expect(bg1).to.not.equal(bg2);
      expect(key1).to.not.equal(key2);
    });

    it("Should ensure background and key colors are different", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);

      for (let i = 0; i < 5; i++) {
        await keyToken.connect(addr1).mint();
        const [bgColor, keyColor] = await keyToken.getTokenColors(i + 1);
        expect(bgColor).to.not.equal(keyColor);
      }
    });

    it("Should generate different colors when minted at different times", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      const factory = await ethers.getContractFactory("KeyToken");
      const keyToken2 = (await factory.deploy()) as KeyToken;
      await keyToken2.waitForDeployment();

      await keyToken.connect(addr1).mint();
      await keyToken2.connect(addr1).mint();

      const [bg1, key1] = await keyToken.getTokenColors(1);
      const [bg2, key2] = await keyToken2.getTokenColors(1);

      expect(bg1).to.not.equal(bg2);
      expect(key1).to.not.equal(key2);
    });

    it("Should use block.timestamp and block.number in color generation", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(2);
      await keyToken.connect(addr2).mint();

      const [bg1, key1] = await keyToken.getTokenColors(1);
      const [bg2, key2] = await keyToken.getTokenColors(2);
      const [bg3, key3] = await keyToken.getTokenColors(3);

      expect(bg1).to.not.equal(bg2);
      expect(bg2).to.not.equal(bg3);
      expect(key1).to.not.equal(key2);
      expect(key2).to.not.equal(key3);

      // All must still be valid hex
      [bg1, bg2, bg3, key1, key2, key3].forEach((c) =>
        expect(c).to.match(/^#[0-9a-f]{6}$/),
      );
    });
  });

  describe("SVGGenerator Library (via KeyToken)", function () {
    it("Should generate valid SVG structure", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const uri = await keyToken.tokenURI(1);
      const meta = parseMetadata(uri);
      const svg = extractSvg(meta);

      expect(svg).to.include(
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
      );
      expect(svg).to.include("</svg>");
      expect(svg).to.match(
        /<rect width="200" height="200" fill="#[0-9a-f]{6}"\/>/,
      );
    });

    it("Should include all key shape elements", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const svg = extractSvg(parseMetadata(await keyToken.tokenURI(1)));

      expect(svg).to.include('<circle cx="60" cy="100" r="20"');
      expect(svg).to.include('<rect x="80" y="95" width="100" height="10"');
      expect(svg).to.include('<path d="M145 80');
      expect(svg).to.include('<path d="M165 86');
    });

    it("Should apply colors correctly to SVG elements", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const [bgColor, keyColor] = await keyToken.getTokenColors(1);
      const svg = extractSvg(parseMetadata(await keyToken.tokenURI(1)));

      expect(svg).to.include(`fill="${bgColor}"`);
      expect(svg).to.include(`stroke="${keyColor}"`);
      expect(svg).to.include(`fill="${keyColor}"`);
    });

    it("Should center key vertically (Y offset of 50)", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();

      const svg = extractSvg(parseMetadata(await keyToken.tokenURI(1)));
      expect(svg).to.include('cy="100"');
      expect(svg).to.include('y="95"');
      expect(svg).to.include('M145 80');
      expect(svg).to.include('M165 86');
    });
  });

  describe("Integration Tests", function () {
    it("Should generate unique SVGs for different tokens", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(3);

      const svgs: string[] = [];
      for (let i = 1; i <= 3; i++) {
        svgs.push(extractSvg(parseMetadata(await keyToken.tokenURI(i))));
      }

      expect(svgs[0]).to.not.equal(svgs[1]);
      expect(svgs[1]).to.not.equal(svgs[2]);
      expect(svgs[0]).to.not.equal(svgs[2]);
    });

    it("Should maintain consistent SVG format across all tokens", async function () {
      const { keyToken, addr1, addr2 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mint();
      await keyToken.connect(addr2).mint();

      for (let i = 1; i <= 2; i++) {
        const meta = parseMetadata(await keyToken.tokenURI(i));
        expect(meta.name).to.match(/^Colored Key #\d+$/);
        expect(meta.description).to.be.a("string");
        expect(meta.image).to.match(/^data:image\/svg\+xml;base64,/);
        expect(meta.attributes).to.have.lengthOf(4);

        const svgPart = meta.image.replace(
          /^data:image\/svg\+xml;base64,/,
          "",
        );
        expect(() => Buffer.from(svgPart, "base64").toString()).to.not.throw();
      }
    });

    it("Should handle color inversion when colors are identical", async function () {
      const { keyToken, addr1 } = await loadFixture(deployKeyTokenFixture);
      await keyToken.connect(addr1).mintBatch(10);

      for (let i = 1; i <= 10; i++) {
        const [bg, key] = await keyToken.getTokenColors(i);
        expect(bg).to.not.equal(key);
        expect(bg).to.match(/^#[0-9a-f]{6}$/);
        expect(key).to.match(/^#[0-9a-f]{6}$/);
      }
    });
  });
});
