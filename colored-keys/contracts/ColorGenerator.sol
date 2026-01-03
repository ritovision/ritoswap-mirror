// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ColorGenerator {
    /**
     * @dev Generates a pseudo-random color based on input seeds
     * @param seed1 First seed value (e.g., tokenId)
     * @param seed2 Second seed value (e.g., block.timestamp)
     * @param seed3 Third seed value (e.g., msg.sender)
     * @return hex color string (e.g., "#FF5733")
     */
    function generateColor(uint256 seed1, uint256 seed2, address seed3) internal pure returns (string memory) {
        // Create a pseudo-random hash from the seeds
        bytes32 hash = keccak256(abi.encodePacked(seed1, seed2, seed3));
        
        // Extract RGB values from the hash
        uint8 r = uint8(hash[0]);
        uint8 g = uint8(hash[1]);
        uint8 b = uint8(hash[2]);
        
        // Convert to hex string
        return string(abi.encodePacked("#", toHexString(r), toHexString(g), toHexString(b)));
    }
    
    /**
     * @dev Generates two distinct colors for background and foreground
     * @param tokenId The token ID to use as seed
     * @param minter The address that minted the token
     * @return backgroundColor The background color
     * @return keyColor The key color
     */
    function generateColorPair(uint256 tokenId, address minter) internal view returns (string memory backgroundColor, string memory keyColor) {
        // Use different seeds to ensure different colors
        backgroundColor = generateColor(tokenId, block.timestamp, minter);
        keyColor = generateColor(tokenId * 2, block.number, minter);
        
        // Ensure sufficient contrast between colors
        // If colors are too similar, adjust the key color
        if (areSimilarColors(backgroundColor, keyColor)) {
            // Invert the key color for contrast
            keyColor = invertColor(keyColor);
        }
        
        return (backgroundColor, keyColor);
    }
    
    /**
     * @dev Converts a single byte to a two-character hex string
     */
    function toHexString(uint8 value) private pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(2);
        result[0] = hexChars[value >> 4];
        result[1] = hexChars[value & 0xf];
        return string(result);
    }
    
    /**
     * @dev Checks if two colors are too similar (simplified check)
     */
    function areSimilarColors(string memory color1, string memory color2) private pure returns (bool) {
        return keccak256(bytes(color1)) == keccak256(bytes(color2));
    }
    
    /**
     * @dev Inverts a color for contrast
     */
    function invertColor(string memory color) private pure returns (string memory) {
        bytes memory colorBytes = bytes(color);
        
        // Skip the # character and process RGB values
        uint8 r = 255 - hexCharToUint8(colorBytes[1], colorBytes[2]);
        uint8 g = 255 - hexCharToUint8(colorBytes[3], colorBytes[4]);
        uint8 b = 255 - hexCharToUint8(colorBytes[5], colorBytes[6]);
        
        return string(abi.encodePacked("#", toHexString(r), toHexString(g), toHexString(b)));
    }
    
    /**
     * @dev Converts two hex characters to uint8
     */
    function hexCharToUint8(bytes1 char1, bytes1 char2) private pure returns (uint8) {
        uint8 digit1 = uint8(char1) < 58 ? uint8(char1) - 48 : uint8(char1) - 87;
        uint8 digit2 = uint8(char2) < 58 ? uint8(char2) - 48 : uint8(char2) - 87;
        return digit1 * 16 + digit2;
    }
}