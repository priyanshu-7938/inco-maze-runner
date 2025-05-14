import { expect } from "chai";
import { namedWallets, wallet, publicClient } from "../utils/wallet";
import {
  Address,
  getContract,
  parseEther,
  formatEther,
  getAddress,
  parseAbiItem,
} from "viem";
import contractAbi from "../artifacts/contracts/MazeRunner.sol/MazeGame.json";
import libContract from "../artifacts/@inco/lightning/src/Lib.sol/e.json";
import { HexString } from "@inco/js/dist/binary";
// @ts-ignore
import { Lightning } from '@inco/js/lite';
import { printMazeFromBytes } from "../utils/mazeutils";
import { patchBytecode } from "../utils/patch"; 
describe("Maze- Runner test", function () {
  let MazeContract: any;
  let contractAddress: Address;
  let incoConfig: any;
  let playerPosition: any = [1,1];
  let libAddress : any;

  before(async function () {
    const chainId = publicClient.chain.id;           // e.g. 84532 or 31337
    console.log("Running on chain:", chainId);
    if(chainId === 31337){
      incoConfig = Lightning.localNode(); // Connect to Inco's latest public testnet
    }else{
      incoConfig = Lightning.latest('testnet', 84532); 
    }
    // deploy the lib: 
    const txn = await wallet.deployContract({
      abi: libContract.abi,
      bytecode: libContract.bytecode as HexString,
    });
    const librec = await publicClient.waitForTransactionReceipt({
      hash: txn,
    });
    libAddress = librec.contractAddress as Address;
    console.log('✅ Library deployed at:', libAddress);
    if(contractAbi.bytecode.includes("__$")){

      const patchedBytecode = patchBytecode(
        contractAbi.bytecode as string,
        contractAbi.linkReferences,
        libAddress
      );
      const txHash = await wallet.deployContract({
        abi: contractAbi.abi,
        bytecode: patchedBytecode as HexString,
        args: [9,9],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      contractAddress = receipt.contractAddress as Address;
    }else{
      const txHash = await wallet.deployContract({
        abi: contractAbi.abi,
        bytecode: contractAbi.bytecode as HexString,
        args: [9,9],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      contractAddress = receipt.contractAddress as Address;
    }
    console.log(`✅ Contract deployed at: ${contractAddress}`);
    // first we wannt uplaod the maze to the contract firstg we generate a maze: of size 15 by 15....
    // Maze has to have the field 1,1 non zero i.e it has to be a empty place so that one can start game from there....
      const amaze = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ];
    // starting point 1,1. need to be a one.
    MazeContract = getContract({
      address: contractAddress as HexString,
      abi: contractAbi.abi,
      client: wallet,
    });

    // feed in the maze to the contract: 
    console.log("Feeding the maze to the contract...");
    for (let i = 0; i < amaze.length; i++) {
      for (let j = 0; j < amaze[i].length; j++) {
        const field = amaze[i][j];
        if (!contractAddress) {
          throw new Error("Contract address is not assigned.");
        }
        const encryptedCipherText = await incoConfig.encrypt(field,{
          accountAddress: wallet.account.address,
          dappAddress: contractAddress
        });
        const txHash = await MazeContract.write.uploadEncryptedCell([i,j,encryptedCipherText]);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      console.log(`✅ Encrypted row (${i}) uploaded.`);
    }
    // Now we will use the contract address to create a new instance of the contract
    // contractAddress = "0xc6a09f78cfb85275e5261200442b0b9aa9d4d0ce";
    // MazeContract = getContract({
    //   address: contractAddress as HexString,
    //   abi: contractAbi.abi,
    //   client: wallet,
    // });
    console.log("✅ Maze successfully fed to the contract.");  
  });
  it("Shold Print the Maze view for location 1,1", async function () {
    const mazeView = await MazeContract.read.viewMapWindow([playerPosition[0],playerPosition[1]]);
    printMazeFromBytes(mazeView);
  });

  it("Should Open a new area of maze, and print it.", async function () {
    const cellRevealCost = await MazeContract.read.cellRevealCost();
    console.log("Cell reveal cost:", cellRevealCost);
    const txHash = await MazeContract.write.revealAreaAroundCheckpoint(
      {
        value: parseEther("0.1")
      }
    );// the location_to_open uses the check point location.
    console.log("Did opened a new area...");
    const mazeView = await MazeContract.read.viewMapWindow([playerPosition[0],playerPosition[1]]);
    printMazeFromBytes(mazeView);

  });

});