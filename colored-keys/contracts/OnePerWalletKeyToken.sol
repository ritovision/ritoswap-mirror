// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./KeyToken.sol";

/**
 * @title OnePerWalletKeyToken
 * @dev Extension of KeyToken that restricts each address to holding at most 1 token
 */
contract OnePerWalletKeyToken is KeyToken {
    
    error AlreadyOwnsToken(address owner);
    error WouldExceedMaxTokensPerWallet(address recipient);
    
    /**
     * @dev Override _update to enforce one token per wallet rule
     * This function is called by _mint, _burn, and _transfer
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        
        // If this is a transfer TO someone (not burning)
        // Check they don't already have a token
        if (to != address(0)) {
            // Allow if they're receiving their first token (balance is 0)
            // or if this is a burn operation (from != address(0) && to == address(0))
            if (balanceOf(to) > 0 && from != to) {
                revert WouldExceedMaxTokensPerWallet(to);
            }
        }
        
        // Proceed with the transfer
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev Override mintBatch to prevent minting multiple tokens
     */
    function mintBatch(uint256 quantity) public override {
        require(quantity == 1, "Can only mint 1 token due to one-per-wallet rule");
        mint();
    }
    
    /**
     * @dev Get the single token owned by an address (if any)
     * @return tokenId The token ID owned by the address, or 0 if none
     * @return hasToken Whether the address owns a token
     */
    function getTokenOfOwner(address owner) public view returns (uint256 tokenId, bool hasToken) {
        uint256 balance = balanceOf(owner);
        if (balance == 0) {
            return (0, false);
        }
        // Since they can only have 1 token, index 0 is their only token
        tokenId = tokenOfOwnerByIndex(owner, 0);
        return (tokenId, true);
    }
}