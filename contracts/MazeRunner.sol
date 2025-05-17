// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@inco/lightning/src/Lib.sol";


contract MazeGame {
    using e for *;

    uint public rows;
    uint public cols;

    // Fully encrypted maze (read-only)
    mapping(uint => euint256) public encryptedMaze;

    // Public maze: 0 = wall, 1 = path, 2 = unexplored
    mapping(uint => uint8) public publicMaze;

    // Player checkpoint (index into 1D grid)
    mapping(address => uint) public playerCheckpoint;

    // Price to reveal a 9x9 area
    uint public cellRevealCost = 0.01 ether;
    
    // ARBITARY:
    
    mapping(uint256 => uint) public pendingDecryptions; // requestId => maze index
    event AreaRevealRequested(address indexed player, uint centerIndex, uint radius);
    
    // ARBITARY ENDS:

    modifier onlyEnclave() {
        require(msg.sender == address(e), "Not authorized");
        _;
    }

    constructor(uint _rows, uint _cols) {
        rows = _rows;
        cols = _cols;
    }

    function index(uint row, uint col) internal view returns (uint) {
        return row * cols + col;
    }

    function uploadEncryptedCell(uint row, uint col, bytes calldata encryptedValue) external {
        uint i = index(row, col);
        if(row == 1 && col == 1) {
            playerCheckpoint[msg.sender] = i;
            publicMaze[i] = 1;
        }
        euint256 mazeValue = e.newEuint256(encryptedValue, msg.sender);
        encryptedMaze[i] = mazeValue;
    }

    function moveCheckpoint(uint[] calldata pathDirections) external {
        uint current = playerCheckpoint[msg.sender];
        uint r = current / cols;
        uint c = current % cols;

        for (uint i = 0; i < pathDirections.length; i++) {
            if (pathDirections[i] == 1 && r > 0) r--;
            else if (pathDirections[i] == 2 && c < cols - 1) c++;
            else if (pathDirections[i] == 3 && r < rows - 1) r++;
            else if (pathDirections[i] == 4 && c > 0) c--;
            else revert("Invalid move");

            uint idx = index(r, c);
            require(publicMaze[idx] == 1, "Cannot move through wall or unexplored");
        }

        playerCheckpoint[msg.sender] = index(r, c);
    }

    function revealAreaAroundCheckpoint() external payable {
        require(msg.value >= cellRevealCost, "Insufficient funds to reveal area");

        uint center = playerCheckpoint[msg.sender];
        uint r = center / cols;
        uint c = center % cols;
        
        int radius = 2;
        
        uint requestCount = 0;
        
        emit AreaRevealRequested(msg.sender, center, uint(radius));
        
        for (int dr = -radius; dr <= radius; dr++) {
            for (int dc = -radius; dc <= radius; dc++) {
                int nr = int(r) + dr;
                int nc = int(c) + dc;

                if (nr >= 0 && nr < int(rows) && nc >= 0 && nc < int(cols)) {
                    uint idx = index(uint(nr), uint(nc));
                    euint256 enc = encryptedMaze[idx];
                    require(e.isAllowed(msg.sender, enc), "Not allowed to reveal this cell");
                    uint256 requestId = e.requestDecryption(
                        enc,
                        this.decryptionCallback.selector,
                        // abi.encode(idx)
                        ""
                    );
                    pendingDecryptions[requestId] = idx;
                    requestCount++;
                }
            }
        }
        
        require(requestCount > 0, "No cells to reveal");
    }

    function decryptionCallback(
        uint256 requestId,
        bytes32 result,
        bytes memory data
    ) public returns (bool){
        // require(msg.sender == address(e), "Unauthorized callback");
        // uint idx = abi.decode(data, (uint));
        // require(pendingDecryptions[requestId] == idx, "Unknown decryption request");
        // publicMaze[idx] = uint8(uint256(result));
        // delete pendingDecryptions[requestId];
        return true;
    }

    // funciton to fetch maze area....
    function viewMapWindow(uint centerRow, uint centerCol) public view returns (bytes memory) {
        int radius = 4;
        bytes memory viewBytes = new bytes(81);

        uint counter = 0;

        for (int dr = -radius; dr <= radius; dr++) {
            for (int dc = -radius; dc <= radius; dc++) {
                int nr = int(centerRow) + dr;
                int nc = int(centerCol) + dc;

                if (nr >= 0 && nr < int(rows) && nc >= 0 && nc < int(cols)) {
                    uint idx = index(uint(nr), uint(nc));
                    viewBytes[counter] = bytes1(publicMaze[idx]);
                } else {
                    viewBytes[counter] = bytes1(uint8(3)); // void area
                }

                counter++;
            }
        }

        return viewBytes;
    }
}
