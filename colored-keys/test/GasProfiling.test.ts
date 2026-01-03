import { expect } from "chai";
import { ethers } from "hardhat";

// Type alias for signers - using any since the proper type isn't available
type SignerWithAddress = any;

describe("Gas Profiling - OnePerWalletKeyToken", function () {
  let token: any;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;

  beforeEach(async function () {
    // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    const OnePerWalletKeyToken = await ethers.getContractFactory("OnePerWalletKeyToken");
    token = await OnePerWalletKeyToken.deploy();
    await token.waitForDeployment();
  });

  describe("mint() Gas Profiling", function () {
    it("Should profile gas for minting operations", async function () {
      // First mint (cold storage)
      const tx1 = await token.connect(addr1).mint();
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Second mint (warm storage)
      const tx2 = await token.connect(addr2).mint();
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      // Third mint
      const tx3 = await token.connect(addr3).mint();
      const receipt3 = await tx3.wait();
      if (!receipt3) throw new Error("Receipt3 is null");

      // Mint after transfer and burn (dirty state)
      await token.connect(addr1).transferFrom(addr1.address, owner.address, 1);
      await token.connect(owner).burn(1);
      
      const tx4 = await token.connect(addr1).mint();
      const receipt4 = await tx4.wait();
      if (!receipt4) throw new Error("Receipt4 is null");

      console.log(`\n    Gas consumption for mint():`);
      console.log(`      First mint (cold storage): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Second mint (warm storage): ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Third mint: ${receipt3.gasUsed.toLocaleString()} gas`);
      console.log(`      Mint after transfer and burn (dirty state): ${receipt4.gasUsed.toLocaleString()} gas`);
      console.log(`      Gas range: ${Math.min(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()} - ${Math.max(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()}`);
    });
  });

  describe("mintBatch() Gas Profiling", function () {
    it("Should profile gas for batch minting operations", async function () {
      // Batch mint single token
      const tx1 = await token.connect(addr1).mintBatch(1);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Regular mint for comparison
      const tx2 = await token.connect(addr2).mint();
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      console.log(`\n    Gas consumption for mintBatch():`);
      console.log(`      Batch size = 1 (minimum): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Regular mint() for comparison: ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Batch overhead: ${(Number(receipt1.gasUsed) - Number(receipt2.gasUsed)).toLocaleString()} gas`);
    });
  });

  describe("transferFrom() Gas Profiling", function () {
    let mockReceiver: any;

    beforeEach(async function () {
      // Deploy mock receiver
      const MockERC721Receiver = await ethers.getContractFactory("MockERC721Receiver");
      mockReceiver = await MockERC721Receiver.deploy();
      await mockReceiver.waitForDeployment();
    });

    it("Should profile gas for transfer operations", async function () {
      // Mint tokens first
      await token.connect(addr1).mint();
      await token.connect(addr2).mint();

      // EOA to EOA (cold recipient)
      const tx1 = await token.connect(addr1).transferFrom(addr1.address, addr3.address, 1);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // EOA to EOA (warm storage) - transfer back to addr1 who no longer has a token
      const tx2 = await token.connect(addr2).transferFrom(addr2.address, addr1.address, 2);
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      console.log(`\n    Gas consumption for transferFrom():`);
      console.log(`      EOA to EOA (cold recipient): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      EOA to EOA (warm storage): ${receipt2.gasUsed.toLocaleString()} gas`);
    });
  });

  describe("safeTransferFrom() Gas Profiling", function () {
    let mockReceiver: any;

    beforeEach(async function () {
      // Deploy mock receiver
      const MockERC721Receiver = await ethers.getContractFactory("MockERC721Receiver");
      mockReceiver = await MockERC721Receiver.deploy();
      await mockReceiver.waitForDeployment();
    });

    it("Should profile gas for safe transfer operations", async function () {
      // Mint token
      await token.connect(addr1).mint();

      // Safe transfer to EOA
      const tx1 = await token.connect(addr1)["safeTransferFrom(address,address,uint256)"](
        addr1.address,
        addr2.address,
        1
      );
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      console.log(`\n    Gas consumption for safeTransferFrom():`);
      console.log(`      safeTransferFrom to EOA: ${receipt1.gasUsed.toLocaleString()} gas`);
    });
  });

  describe("approve() Gas Profiling", function () {
    it("Should profile gas for approval operations", async function () {
      // Mint token
      await token.connect(owner).mint();

      // First approval (cold)
      const tx1 = await token.connect(owner).approve(addr1.address, 1);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Change approval (warm)
      const tx2 = await token.connect(owner).approve(addr2.address, 1);
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      // Clear approval
      const tx3 = await token.connect(owner).approve(ethers.ZeroAddress, 1);
      const receipt3 = await tx3.wait();
      if (!receipt3) throw new Error("Receipt3 is null");

      // Re-approve after clear
      const tx4 = await token.connect(owner).approve(addr1.address, 1);
      const receipt4 = await tx4.wait();
      if (!receipt4) throw new Error("Receipt4 is null");

      console.log(`\n    Gas consumption for approve():`);
      console.log(`      First approval (cold): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Change approval (warm): ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Clear approval: ${receipt3.gasUsed.toLocaleString()} gas`);
      console.log(`      Re-approve after clear: ${receipt4.gasUsed.toLocaleString()} gas`);
      console.log(`      Gas range: ${Math.min(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()} - ${Math.max(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()}`);
    });
  });

  describe("setApprovalForAll() Gas Profiling", function () {
    it("Should profile gas for operator approval operations", async function () {
      // First operator approval (cold)
      const tx1 = await token.connect(owner).setApprovalForAll(addr1.address, true);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Second operator approval
      const tx2 = await token.connect(owner).setApprovalForAll(addr2.address, true);
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      // Revoke operator
      const tx3 = await token.connect(owner).setApprovalForAll(addr1.address, false);
      const receipt3 = await tx3.wait();
      if (!receipt3) throw new Error("Receipt3 is null");

      // Re-approve operator
      const tx4 = await token.connect(owner).setApprovalForAll(addr1.address, true);
      const receipt4 = await tx4.wait();
      if (!receipt4) throw new Error("Receipt4 is null");

      console.log(`\n    Gas consumption for setApprovalForAll():`);
      console.log(`      First operator approval (cold): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Second operator approval: ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Revoke operator: ${receipt3.gasUsed.toLocaleString()} gas`);
      console.log(`      Re-approve operator: ${receipt4.gasUsed.toLocaleString()} gas`);
      console.log(`      Gas range: ${Math.min(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()} - ${Math.max(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()}`);
    });
  });

  describe("burn() Gas Profiling", function () {
    it("Should profile gas for burn operations", async function () {
      // Mint and burn (clean)
      await token.connect(owner).mint();
      const tx1 = await token.connect(owner).burn(1);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Burn after transfers (dirty)
      await token.connect(owner).mint();
      await token.connect(owner).transferFrom(owner.address, addr1.address, 2);
      await token.connect(addr1).transferFrom(addr1.address, owner.address, 2);
      const tx2 = await token.connect(owner).burn(2);
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      // Burn with approvals
      await token.connect(owner).mint();
      await token.connect(owner).approve(addr1.address, 3);
      await token.connect(owner).setApprovalForAll(addr2.address, true);
      const tx3 = await token.connect(owner).burn(3);
      const receipt3 = await tx3.wait();
      if (!receipt3) throw new Error("Receipt3 is null");

      // Burn after re-mint
      await token.connect(owner).mint();
      const tx4 = await token.connect(owner).burn(4);
      const receipt4 = await tx4.wait();
      if (!receipt4) throw new Error("Receipt4 is null");

      console.log(`\n    Gas consumption for burn():`);
      console.log(`      Burn after mint (clean): ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Burn after transfers (dirty): ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Burn with approvals: ${receipt3.gasUsed.toLocaleString()} gas`);
      console.log(`      Burn after re-mint: ${receipt4.gasUsed.toLocaleString()} gas`);
      console.log(`      Gas range: ${Math.min(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()} - ${Math.max(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed), Number(receipt4.gasUsed)).toLocaleString()}`);
    });
  });

  describe("Composite Operations Gas Profiling", function () {
    it("Should profile gas for complex scenarios", async function () {
      // @ts-expect-error TS2339
      const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();
      
      // Setup - mint tokens
      await token.connect(owner).mint();  // owner has token 1
      await token.connect(addr1).mint();  // addr1 has token 2
      await token.connect(addr2).mint();  // addr2 has token 3
      
      // Approved transferFrom - owner approves addr3 to transfer to addr4 (who has no token)
      await token.connect(owner).approve(addr3.address, 1);
      const tx1 = await token.connect(addr3).transferFrom(owner.address, addr4.address, 1);
      const receipt1 = await tx1.wait();
      if (!receipt1) throw new Error("Receipt1 is null");

      // Operator transferFrom - addr1 sets addr3 as operator, transfers to addr5 (who has no token)
      await token.connect(addr1).setApprovalForAll(addr3.address, true);
      const tx2 = await token.connect(addr3).transferFrom(addr1.address, addr5.address, 2);
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Receipt2 is null");

      // Approved burn - addr2 approves owner to burn their token
      await token.connect(addr2).approve(owner.address, 3);
      const tx3 = await token.connect(owner).burn(3);
      const receipt3 = await tx3.wait();
      if (!receipt3) throw new Error("Receipt3 is null");

      console.log(`\n    Gas consumption for composite operations:`);
      console.log(`      Approved transferFrom: ${receipt1.gasUsed.toLocaleString()} gas`);
      console.log(`      Operator transferFrom: ${receipt2.gasUsed.toLocaleString()} gas`);
      console.log(`      Approved burn: ${receipt3.gasUsed.toLocaleString()} gas`);
      console.log(`      Gas range: ${Math.min(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed)).toLocaleString()} - ${Math.max(Number(receipt1.gasUsed), Number(receipt2.gasUsed), Number(receipt3.gasUsed)).toLocaleString()}`);
    });
  });

  describe("Gas Summary Report", function () {
    it("Should generate comprehensive gas report", async function () {
      console.log(`\n    Collecting gas samples...`);
      
      const gasData: { [key: string]: bigint[] } = {
        mint: [],
        transferFrom: []
      };

      // Need to use different addresses for each mint due to one-per-wallet rule
      // @ts-expect-error TS2339
      const signers = await ethers.getSigners();
      
      // Collect mint samples
      for (let i = 0; i < 5; i++) {
        const tx = await token.connect(signers[i]).mint();
        const receipt = await tx.wait();
        if (!receipt) throw new Error(`Mint receipt ${i} is null`);
        gasData.mint.push(receipt.gasUsed);
      }

      // For transfers, need tokens to exist first
      // Transfer between signers
      for (let i = 0; i < 3; i++) {
        const from = signers[i];
        const to = signers[i + 5]; // Use different signers that don't have tokens
        const tx = await token.connect(from).transferFrom(from.address, to.address, i + 1);
        const receipt = await tx.wait();
        if (!receipt) throw new Error(`Transfer receipt ${i} is null`);
        gasData.transferFrom.push(receipt.gasUsed);
      }

      // Calculate statistics
      const calculateStats = (data: bigint[]) => {
        const numbers = data.map(n => Number(n));
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const variance = numbers.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / numbers.length;
        const std = Math.sqrt(variance);
        return { min, max, avg: Math.round(avg), std: Math.round(std) };
      };

      const mintStats = calculateStats(gasData.mint);
      const transferStats = calculateStats(gasData.transferFrom);

      console.log(`\n    ╔════════════════════════════════════════════╗`);
      console.log(`    ║         GAS CONSUMPTION SUMMARY            ║`);
      console.log(`    ╠════════════════════════════════════════════╣`);
      console.log(`    ║ mint            │ Min: ${mintStats.min.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Max: ${mintStats.max.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Avg: ${mintStats.avg.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Std: ± ${mintStats.std.toLocaleString().padStart(5)} │`);
      console.log(`    ╟────────────────────────────────────────────╢`);
      console.log(`    ║ transferFrom    │ Min: ${transferStats.min.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Max: ${transferStats.max.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Avg: ${transferStats.avg.toLocaleString().padStart(7)} │`);
      console.log(`    ║                 │ Std: ±${transferStats.std.toLocaleString().padStart(6)} │`);
      console.log(`    ╟────────────────────────────────────────────╢`);
      console.log(`    ╚════════════════════════════════════════════╝`);
    });
  });
});