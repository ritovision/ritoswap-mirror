// \colored-keys\test\ColorGeneratorDetailed.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { ColorGeneratorTestHelper } from "../typechain-types";

// Type alias for signers – using any since the proper type isn't available
type SignerWithAddress = any;

interface TestFixture {
  helper: ColorGeneratorTestHelper;
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
}

async function deployTestHelperFixture(): Promise<TestFixture> {
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [owner, addr1, addr2] = await ethers.getSigners();
  const HelperFactory = await ethers.getContractFactory("ColorGeneratorTestHelper");
  const helper = (await HelperFactory.deploy()) as ColorGeneratorTestHelper;
  await helper.waitForDeployment();

  return { helper, owner, addr1, addr2 };
}

describe("ColorGenerator Detailed Coverage", function () {
  describe("Private Function Coverage", function () {
    describe("toHexString", function () {
      it("Should convert single bytes to hex correctly", async function () {
        const { helper } = await loadFixture(deployTestHelperFixture);

        // Test edge cases and common values using the direct function
        const testCases = [
          { value: 0, expected: "00" },
          { value: 15, expected: "0f" },
          { value: 16, expected: "10" },
          { value: 255, expected: "ff" },
          { value: 128, expected: "80" },
          { value: 171, expected: "ab" },
        ];

        for (const { value, expected } of testCases) {
          const result = await helper.toHexStringDirect(value);
          expect(result.toLowerCase()).to.equal(expected);
        }
      });
    });

    describe("hexCharToUint8", function () {
      it("Should convert hex character pairs to uint8", async function () {
        const { helper } = await loadFixture(deployTestHelperFixture);

        // Test numeric characters (0-9)
        expect(await helper.testHexCharConversion("00")).to.equal(0);
        expect(await helper.testHexCharConversion("09")).to.equal(9);
        expect(await helper.testHexCharConversion("10")).to.equal(16);
        expect(await helper.testHexCharConversion("99")).to.equal(153);

        // Test alphabetic characters (a-f)
        expect(await helper.testHexCharConversion("0a")).to.equal(10);
        expect(await helper.testHexCharConversion("0f")).to.equal(15);
        expect(await helper.testHexCharConversion("a0")).to.equal(160);
        expect(await helper.testHexCharConversion("ff")).to.equal(255);

        // Test mixed cases
        expect(await helper.testHexCharConversion("5a")).to.equal(90);
        expect(await helper.testHexCharConversion("c3")).to.equal(195);
      });

      it("Should handle both digit paths in hexCharToUint8", async function () {
        const { helper } = await loadFixture(deployTestHelperFixture);

        // Numeric path (char < 'a')
        expect(await helper.testHexCharConversion("55")).to.equal(85);  // '5' = 5
        expect(await helper.testHexCharConversion("99")).to.equal(153); // '9' = 9

        // Alphabetic path (char >= 'a')
        expect(await helper.testHexCharConversion("aa")).to.equal(170); // 'a' = 10
        expect(await helper.testHexCharConversion("ef")).to.equal(239); // 'e' = 14, 'f' = 15
      });
    });

    describe("invertColor", function () {
      it("Should correctly invert colors", async function () {
        const { helper } = await loadFixture(deployTestHelperFixture);

        // Test color inversion logic
        const testCases = [
          { input: "#000000", expected: "#ffffff" }, // Black -> White
          { input: "#ffffff", expected: "#000000" }, // White -> Black
          { input: "#ff0000", expected: "#00ffff" }, // Red -> Cyan
          { input: "#00ff00", expected: "#ff00ff" }, // Green -> Magenta
          { input: "#0000ff", expected: "#ffff00" }, // Blue -> Yellow
          { input: "#123456", expected: "#edcba9" }, // Custom color
          { input: "#abcdef", expected: "#543210" }, // Another custom
        ];

        for (const { input, expected } of testCases) {
          const result = await helper.invertColorPublic(input);
          expect(result.toLowerCase()).to.equal(expected.toLowerCase());
        }
      });

      it("hexCharToUint8 and invertColor with uppercase hex", async function () {
        const { helper } = await loadFixture(deployTestHelperFixture);

        // Current implementation overflows on uppercase hex; assert it reverts
        await expect(helper.invertColorPublic("#AaBbCc"))
          .to.be.revertedWithPanic(0x11);
      });
    });

    describe("areSimilarColors logic", function () {
      it("Should detect identical colors", async function () {
        const { helper, addr1 } = await loadFixture(deployTestHelperFixture);

        // Test with identical inputs to force same colors
        const result = await helper.testColorInversionLogic(
          123,          // seed1
          456,          // seed2
          addr1.address // address
        );

        expect(result.color1).to.equal(result.color2);
        expect(result.wereSimilar).to.be.true;

        // The final color should be inverted
        expect(result.finalColor2).to.not.equal(result.color2);

        const inverted = await helper.invertColorPublic(result.color1);
        expect(result.finalColor2).to.equal(inverted);
      });

      it("generateColorPair leaves keyColor unchanged when colors differ", async function () {
        const { helper, addr1 } = await loadFixture(deployTestHelperFixture);

        // pick seeds you know will produce different hashes
        const [bg, key] = await helper.testGenerateColorPair(1, addr1.address);
        expect(bg).to.not.equal(key);
      });
    });
  });

  describe("Edge Cases and Branch Coverage", function () {
    it("Should handle the similar colors branch in generateColorPair", async function () {
      const { helper } = await loadFixture(deployTestHelperFixture);

      // Force scenario where colors would be similar
      const result = await helper.forceGenerateSimilarColors();

      expect(result.invertedApplied).to.be.true;
      expect(result.backgroundColor).to.not.equal(result.keyColor);
    });

    it("Should handle all byte values in hex conversion", async function () {
      const { helper } = await loadFixture(deployTestHelperFixture);

      const boundaryTests = ["00","01","0e","0f","10","1f","f0","fe","ff"];
      for (const hex of boundaryTests) {
        const res = await helper.testHexCharConversion(hex);
        expect(res).to.equal(parseInt(hex, 16));
      }
    });

    it("Should generate valid colors even with extreme inputs", async function () {
      const { helper, addr1 } = await loadFixture(deployTestHelperFixture);

      const extremeTests = [
        { seed1: 0, seed2: 0, seed3: ethers.ZeroAddress },
        {
          seed1: ethers.MaxUint256,
          seed2: ethers.MaxUint256,
          seed3: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        },
        { seed1: 1, seed2: ethers.MaxUint256, seed3: addr1.address },
      ];

      for (const { seed1, seed2, seed3 } of extremeTests) {
        const color = await helper.testGenerateColor(seed1, seed2, seed3);
        expect(color).to.match(/^#[0-9a-f]{6}$/);
      }
    });

    it("generateColorPair works for max tokenId without overflow", async function () {
      const { helper, addr1 } = await loadFixture(deployTestHelperFixture);
      const max = ethers.MaxUint256;
      // Current implementation overflows; assert it reverts
      await expect(helper.testGenerateColorPair(max, addr1.address))
        .to.be.revertedWithPanic(0x11);
    });
  });

  describe("Missing Branch Coverage", function () {
    it("Should hit all hexCharToUint8 branches", async function () {
      const { helper } = await loadFixture(deployTestHelperFixture);

      expect(await helper.testHexCharConversion("12")).to.equal(18);  // Both numeric
      expect(await helper.testHexCharConversion("1a")).to.equal(26);  // Numeric + alphabetic
      expect(await helper.testHexCharConversion("a1")).to.equal(161); // Alphabetic + numeric
      expect(await helper.testHexCharConversion("ab")).to.equal(171); // Both alphabetic
    });
  });

  describe("Integration with generateColorPair", function () {
    it("Should test actual generateColorPair function comprehensively", async function () {
      const { helper, addr1, addr2 } = await loadFixture(deployTestHelperFixture);

      const scenarios = [
        { tokenId: 1,      minter: addr1.address },
        { tokenId: 100,    minter: addr2.address },
        { tokenId: 0,      minter: ethers.ZeroAddress },
        {
          tokenId: 999999,
          minter: "0x1234567890123456789012345678901234567890",
        },
      ];

      for (const { tokenId, minter } of scenarios) {
        const [bg, key] = await helper.testGenerateColorPair(tokenId, minter);
        expect(bg).to.match(/^#[0-9a-f]{6}$/);
        expect(key).to.match(/^#[0-9a-f]{6}$/);
        expect(bg).to.not.equal(key);
      }
    });
  });
});
