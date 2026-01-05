// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SVGGenerator {
    /**
     * @dev Generates the SVG for a key with specified colors, manually centered vertically.
     * @param backgroundColor The background color
     * @param keyColor The key color
     * @return The complete SVG as a string
     */
    function generateKeySVG(string memory backgroundColor, string memory keyColor) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
            '<rect width="200" height="200" fill="', backgroundColor, '"/>',
            generateKeyShape(keyColor),
            '</svg>'
        ));
    }
    
    /**
     * @dev Generates the key shape elements with Ys bumped +50.
     * @param keyColor The color for the key
     * @return The key shape SVG elements
     */
    function generateKeyShape(string memory keyColor) private pure returns (string memory) {
        return string(abi.encodePacked(
            // Single ring, cy: 50→100
            '<circle cx="60" cy="100" r="20" fill="none" stroke="', keyColor, '" stroke-width="10"/>',
            // Shaft, y: 45→95
            '<rect x="80" y="95" width="100" height="10" rx="5" fill="', keyColor, '"/>',
            // First tooth, all Ys +50: 30→80,35→85,46→96
            '<path d="M145 80 A5 5 0 0 1 150 85 V96 H140 V85 A5 5 0 0 1 145 80 Z" fill="', keyColor, '"/>',
            // Second tooth, Ys +50: 36→86,41→91,46→96
            '<path d="M165 86 A5 5 0 0 1 170 91 V96 H160 V91 A5 5 0 0 1 165 86 Z" fill="', keyColor, '"/>'
        ));
    }
}
