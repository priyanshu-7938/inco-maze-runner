// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@inco/lightning/src/Lib.sol";

contract MazeGame {
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

    // code to upload the maze to the contract.... step by step....    
    function uploadEncryptedCell(uint row, uint col, bytes calldata encryptedValue) external {
        uint i = index(row, col);
        if(row == 1 && col == 1) {
            playerCheckpoint[msg.sender] = i; // set initial checkpoint
            publicMaze[i] = 1; // mark the starting point as path
        }
        euint256 mazeValue = e.newEuint256(encryptedValue, msg.sender);
        encryptedMaze[i] = mazeValue;
    }

    // move the check point to a new position....
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

    // opening new area in maze....
    function revealAreaAroundCheckpoint() external payable {
        require(msg.value >= cellRevealCost);

        uint center = playerCheckpoint[msg.sender];
        uint r = center / cols;
        uint c = center % cols;

        // int radius = 4;
        int radius = 2;// to keep it small baby...

        for (int dr = -radius; dr <= radius; dr++) {
            for (int dc = -radius; dc <= radius; dc++) {
                int nr = int(r) + dr;
                int nc = int(c) + dc;

                if (nr >= 0 && nr < int(rows) && nc >= 0 && nc < int(cols)) {
                    uint idx = index(uint(nr), uint(nc));
                    euint256 enc = encryptedMaze[idx];
                    e.requestDecryption(
                        enc,
                        this.callback.selector,
                        abi.encode(idx)
                    );
                }
            }
        }
    }

    function callback(
        euint256 id,
        uint256 val,
        bytes memory callbackData
    ) external {
        uint idx = abi.decode(callbackData, (uint));
        publicMaze[idx] = uint8(val); // 0 = wall, 1 = path
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
