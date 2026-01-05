// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../OnePerWalletKeyToken.sol";

/**
 * @dev Echidna test harness for OnePerWalletKeyToken
 * Place this file in contracts/test/EchidnaOnePerWalletKeyToken.sol
 */
contract EchidnaOnePerWalletKeyToken is OnePerWalletKeyToken {
    // Track test users
    address constant USER1 = address(0x10000);
    address constant USER2 = address(0x20000);
    address constant USER3 = address(0x30000);
    
    constructor() {
        // Mint initial tokens for testing
        _mint(USER1, 1);
        _mint(USER2, 2);
    }
    
    // Invariant: No address should have more than 1 token
    function echidna_one_token_per_wallet() public view returns (bool) {
        return balanceOf(USER1) <= 1 && 
               balanceOf(USER2) <= 1 && 
               balanceOf(USER3) <= 1 &&
               balanceOf(msg.sender) <= 1;
    }
    
    // Invariant: Token ownership consistency
    function echidna_token_ownership() public view returns (bool) {
        // Check first 10 tokens
        for (uint256 i = 1; i <= 10 && i <= totalSupply(); i++) {
            try this.ownerOf(i) returns (address owner) {
                if (owner == address(0)) return false;
                if (balanceOf(owner) == 0) return false;
            } catch {
                // Token burned, ok
            }
        }
        return true;
    }
    
    // Test minting
    function mint_test() public {
        try this.mint() {
            // Success
        } catch {
            // Expected if already owns token
        }
    }
    
    // Test transfers
    function transfer_test(address to) public {
        if (to == address(0) || to == msg.sender) return;
        
        uint256 balance = balanceOf(msg.sender);
        if (balance > 0) {
            uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);
            try this.transferFrom(msg.sender, to, tokenId) {
                // Success
            } catch {
                // Expected if recipient already has token
            }
        }
    }
    
    // Test burning
    function burn_test() public {
        uint256 balance = balanceOf(msg.sender);
        if (balance > 0) {
            uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);
            try this.burn(tokenId) {
                // Success
            } catch {
                // Should not fail if owns token
            }
        }
    }
}