// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BadERC721Receiver
 * @dev Does *not* implement IERC721Receiver, so any safeTransfer to this
 *      contract will hit the “revert on missing ERC721Receiver” branch.
 */
contract BadERC721Receiver {
    // no onERC721Received()
}
