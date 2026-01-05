// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./ColorGenerator.sol";
import "./SVGGenerator.sol";

contract KeyToken is ERC721Enumerable, ERC721Burnable {
    using Strings for uint256;
    using ColorGenerator for uint256;
    using SVGGenerator for string;
    
    uint256 private _nextTokenId = 1;
    
    // Mapping to store color data for each token
    mapping(uint256 => ColorData) private _tokenColors;
    
    struct ColorData {
        string backgroundColor;
        string keyColor;
        address minter;
        uint256 mintedAt;
    }
    
    constructor() ERC721("Colored Keys", "CKEY") {}
    
    /**
     * @dev Public minting function - anyone can mint
     */
    function mint() public {
        uint256 tokenId = _nextTokenId++;
        
        // Generate and store colors
        (string memory bgColor, string memory keyColor) = ColorGenerator.generateColorPair(tokenId, msg.sender);
        _tokenColors[tokenId] = ColorData({
            backgroundColor: bgColor,
            keyColor: keyColor,
            minter: msg.sender,
            mintedAt: block.timestamp
        });
        
        _safeMint(msg.sender, tokenId);
    }
    
    /**
     * @dev Batch minting function
     * @param quantity Number of tokens to mint (max 10 per transaction)
     */
    function mintBatch(uint256 quantity) public virtual {
        require(quantity > 0 && quantity <= 10, "Quantity must be between 1 and 10");
        
        for (uint256 i = 0; i < quantity; i++) {
            mint();
        }
    }
    
    /**
     * @dev Returns the token URI with inline SVG and metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        
        ColorData memory colors = _tokenColors[tokenId];
        
        // Generate the SVG
        string memory svg = SVGGenerator.generateKeySVG(colors.backgroundColor, colors.keyColor);
        string memory svgBase64 = Base64.encode(bytes(svg));
        
        // Create attributes array
        string memory attributes = string(abi.encodePacked(
            '[',
            '{"trait_type":"Background Color","value":"', colors.backgroundColor, '"},',
            '{"trait_type":"Key Color","value":"', colors.keyColor, '"},',
            '{"trait_type":"Minter","value":"', Strings.toHexString(uint160(colors.minter), 20), '"},',
            '{"trait_type":"Minted At","value":"', colors.mintedAt.toString(), '"}',
            ']'
        ));
        
        // Create the JSON metadata
        string memory json = string(abi.encodePacked(
            '{"name":"Colored Key #', tokenId.toString(),
            '","description":"A fully on-chain key generated with algorithmically randomized colors. What does it unlock?",',
            '"image":"data:image/svg+xml;base64,', svgBase64,
            '","attributes":', attributes,
            '}'
        ));
        
        // Base64 encode the JSON
        string memory jsonBase64 = Base64.encode(bytes(json));
        
        return string(abi.encodePacked("data:application/json;base64,", jsonBase64));
    }
    
    /**
     * @dev Get color data for a specific token
     */
    function getTokenColors(uint256 tokenId) public view returns (string memory backgroundColor, string memory keyColor) {
        _requireOwned(tokenId);
        ColorData memory colors = _tokenColors[tokenId];
        return (colors.backgroundColor, colors.keyColor);
    }
    
    /**
     * @dev Get all tokens owned by an address
     */
    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokens;
    }
    
    // Required overrides for multiple inheritance
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}