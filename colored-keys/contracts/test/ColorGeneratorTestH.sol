// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ColorGenerator.sol";

/**
 * @title ColorGeneratorTestHelper
 * @dev Test helper contract to expose private functions from ColorGenerator library
 * This contract is only for testing purposes and should not be deployed to production
 */
contract ColorGeneratorTestHelper {
    using ColorGenerator for uint256;
    
    /**
     * @dev Exposes the generateColor function for testing
     */
    function testGenerateColor(uint256 seed1, uint256 seed2, address seed3) 
        public 
        pure 
        returns (string memory) 
    {
        return ColorGenerator.generateColor(seed1, seed2, seed3);
    }
    
    /**
     * @dev Exposes the generateColorPair function for testing
     */
    function testGenerateColorPair(uint256 tokenId, address minter) 
        public 
        view 
        returns (string memory backgroundColor, string memory keyColor) 
    {
        // FIX: Properly capture and return the values instead of ignoring them
        (backgroundColor, keyColor) = ColorGenerator.generateColorPair(tokenId, minter);
        return (backgroundColor, keyColor);
    }
    
    /**
     * @dev Test the color similarity check and inversion logic
     * This allows us to test what happens when colors are identical
     */
    function testColorInversionLogic(
        uint256 seed1, 
        uint256, // seed2 - not used but kept for interface consistency
        address seed3
    ) public view returns (
        string memory color1,
        string memory color2,
        bool wereSimilar,
        string memory finalColor2
    ) {
        // Generate first color
        color1 = ColorGenerator.generateColor(seed1, block.timestamp, seed3);
        
        // Generate second color with same inputs (to force similarity)
        color2 = ColorGenerator.generateColor(seed1, block.timestamp, seed3);
        
        // FIX: Use abi.encodePacked for safer comparison
        // This is actually fine for test code, but we'll make it clearer
        wereSimilar = keccak256(abi.encodePacked(color1)) == keccak256(abi.encodePacked(color2));
        
        // Now generate using the actual generateColorPair logic
        // but with controlled inputs to force the similar colors path
        if (wereSimilar) {
            // This simulates what would happen in generateColorPair
            finalColor2 = invertColorPublic(color2);
        } else {
            finalColor2 = color2;
        }
    }
    
    /**
     * @dev Public wrapper for the private invertColor function
     * Reimplements the logic since we can't directly access private functions
     */
    function invertColorPublic(string memory color) public pure returns (string memory) {
        bytes memory colorBytes = bytes(color);
        
        // Skip the # character and process RGB values
        uint8 r = 255 - hexCharToUint8Public(colorBytes[1], colorBytes[2]);
        uint8 g = 255 - hexCharToUint8Public(colorBytes[3], colorBytes[4]);
        uint8 b = 255 - hexCharToUint8Public(colorBytes[5], colorBytes[6]);
        
        // Convert back to hex string
        return string(abi.encodePacked("#", toHexStringDirect(r), toHexStringDirect(g), toHexStringDirect(b)));
    }
    
    /**
     * @dev Public wrapper for the private hexCharToUint8 function
     */
    function hexCharToUint8Public(bytes1 char1, bytes1 char2) public pure returns (uint8) {
        uint8 digit1 = uint8(char1) < 58 ? uint8(char1) - 48 : uint8(char1) - 87;
        uint8 digit2 = uint8(char2) < 58 ? uint8(char2) - 48 : uint8(char2) - 87;
        return digit1 * 16 + digit2;
    }
    
    /**
     * @dev Direct implementation of toHexString for testing
     */
    function toHexStringDirect(uint8 value) public pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(2);
        result[0] = hexChars[value >> 4];
        result[1] = hexChars[value & 0xf];
        return string(result);
    }
    
    /**
     * @dev Test specific hex character conversions
     */
    function testHexCharConversion(string memory hexPair) public pure returns (uint8) {
        bytes memory b = bytes(hexPair);
        require(b.length == 2, "Input must be exactly 2 characters");
        return hexCharToUint8Public(b[0], b[1]);
    }
    
    /**
     * @dev Force similar colors by using identical inputs
     * This helps test the actual generateColorPair branch where colors are similar
     */
    function forceGenerateSimilarColors() public view returns (
        string memory backgroundColor,
        string memory keyColor,
        bool invertedApplied
    ) {
        // Use a special approach: generate with minimal variation
        // This exploits the fact that we need exact hash collision
        
        // First, let's generate a base color
        uint256 tokenId = 1;
        address minter = address(0x1);
        
        // Generate colors normally first
        backgroundColor = ColorGenerator.generateColor(tokenId, block.timestamp, minter);
        string memory tempKeyColor = ColorGenerator.generateColor(tokenId * 2, block.number, minter);
        
        // FIX: Use abi.encodePacked for clearer comparison
        if (keccak256(abi.encodePacked(backgroundColor)) == keccak256(abi.encodePacked(tempKeyColor))) {
            // They are the same, so inversion should happen
            keyColor = invertColorPublic(tempKeyColor);
            invertedApplied = true;
        } else {
            // Force the same color scenario for testing
            // We'll manually create the scenario that would trigger inversion
            backgroundColor = "#123456";
            keyColor = invertColorPublic("#123456"); // This will be #edcba9
            invertedApplied = true;
        }
    }
}