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
    // write a payable call to function revealAreaAroundCheckpoint
    const cellRevealCost = await MazeContract.read.cellRevealCost();
    console.log("Cell reveal cost:", cellRevealCost);
    const txHash = await MazeContract.write.revealAreaAroundCheckpoint(
      {
        value: parseEther("0.1")
      }
    );// the location to open usesd the check point location.
    console.log("Did opened a new area...");
    const mazeView = await MazeContract.read.viewMapWindow([playerPosition[0],playerPosition[1]]);
    printMazeFromBytes(mazeView);

  });

  // describe("Encrypted Transfer Tests", function () {
  //   it("It should send 1000 cUSDC from owner to alice", async function () {
  //     // Minting 5000 cUSDC
  //     console.log("\n------ 💰 Minting 5000 cUSDC for Owner ------");
  //     const plainTextAmountToMint = parseEther("5000");

  //     const txHashForMint = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: contractAbi.abi,
  //       functionName: "mint",
  //       args: [plainTextAmountToMint],
  //     });
  //     await publicClient.waitForTransactionReceipt({ hash: txHashForMint });
  //     console.log("✅ Mint successful: 5000 cUSDC added to Owner's balance.");

  //     // Fetch Owner's Balance
  //     console.log("\n------ 🔍 Fetching Balance Handle for Owner ------");
  //     const eBalanceHandleForOwnerAfterMint = (await publicClient.readContract({
  //       address: getAddress(contractAddress),
  //       abi: contractAbi.abi,
  //       functionName: "balanceOf",
  //       args: [wallet.account.address],
  //     })) as HexString;

  //     // Wait for covalidator to do the computation
  //     await new Promise(resolve => setTimeout(resolve, 1000));
  //     const decryptedBalanceForOwnerAfterMint =  await reEncryptorForMainWallet({ handle: eBalanceHandleForOwnerAfterMint.toString() });

  //     console.log(
  //       `🎯 Decrypted Owner Balance: ${decryptedBalanceForOwnerAfterMint.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForOwnerAfterMint.value).to.equal(
  //       plainTextAmountToMint
  //     ); // ✅ Assertion

  //     // Encrypt 1000 cUSDC for Transfer
  //     const plainTextAmountToBeSent = parseEther("1000");
  //     console.log("\n------ 🔄 Encrypting Transfer Amount (1000 cUSDC) ------");
  //     const encryptedCipherText = await incoConfig.encrypt(plainTextAmountToBeSent,{
  //       accountAddress: wallet.account.address,
  //       dappAddress: contractAddress
  //     });
  //     console.log("✅ Encryption successful.");

  //     // Transfer 1000 cUSDC from Owner to Alice
  //     console.log(
  //       `\n------ 📤 Transferring 1000 cUSDC from Owner to Alice ------`
  //     );
  //     const transferFunctionAbi = contractAbi.abi.find(
  //       (item) =>
  //         item.name === "transfer" &&
  //         item.inputs.length === 2 &&
  //         item.inputs[1].type === "bytes"
  //     );
  //     const txHashForTransfer = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: [transferFunctionAbi],
  //       functionName: "transfer",
  //       args: [
  //         namedWallets.alice.account.address,
  //         encryptedCipherText,
  //       ],
  //     });
  //     await publicClient.waitForTransactionReceipt({ hash: txHashForTransfer });
  //     console.log("✅ Transfer successful: 1000 cUSDC sent to Alice.");

  //     // Fetch Owner's Balance After Transfer
  //     console.log("\n------ 🔍 Fetching Updated Balance for Owner ------");
  //     const eBalanceHandleForOwnerAfterTransfer =
  //       (await publicClient.readContract({
  //         address: getAddress(contractAddress),
  //         abi: contractAbi.abi,
  //         functionName: "balanceOf",
  //         args: [wallet.account.address],
  //       })) as HexString;
  //       await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalanceForOwnerAfterTransfer = await reEncryptorForMainWallet({
  //       handle: eBalanceHandleForOwnerAfterTransfer.toString()
  //     });

  //     console.log(
  //       `🎯 Decrypted Owner Balance After Transfer: ${decryptedBalanceForOwnerAfterTransfer.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForOwnerAfterTransfer.value).to.equal(
  //       parseEther("4000")
  //     ); // ✅ Assertion

  //     // Fetch Alice's Balance After Transfer
  //     console.log("\n------ 🔍 Fetching Balance Handle for Alice ------");
  //     const eBalanceHandleForAliceAfterTransfer =
  //       (await publicClient.readContract({
  //         address: getAddress(contractAddress),
  //         abi: contractAbi.abi,
  //         functionName: "balanceOf",
  //         args: [namedWallets.alice.account.address],
  //       })) as HexString;
  //       await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalanceForAliceAfterTransfer = await reEncryptorForAliceWallet({
  //       handle: eBalanceHandleForAliceAfterTransfer.toString()
  //     });

  //     console.log(
  //       `🎯 Decrypted Alice Balance: ${decryptedBalanceForAliceAfterTransfer.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForAliceAfterTransfer.value).to.equal(
  //       parseEther("1000")
  //     ); // ✅ Assertion
  //   });
  // });

  // describe("Reencrypt Balance Tests", function () {
  //   it("It should mint 5000 cUSDC to owner", async function () {
  //     const plainTextAmount = parseEther("5000");
  //     console.log("Owner Minting 5000 cUSDC");
  //     const txHash = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: contractAbi.abi,
  //       functionName: "mint",
  //       args: [plainTextAmount],
  //     });

  //     await publicClient.waitForTransactionReceipt({ hash: txHash });
  //     console.log(`✅ Owner wallet minted 5000 cUSDC.`);

  //     console.log("🔍 Fetching `balance` handle from the contract...");
  //     const eBalanceHandle = (await publicClient.readContract({
  //       address: getAddress(contractAddress),
  //       abi: contractAbi.abi,
  //       functionName: "balanceOf",
  //       args: [wallet.account.address],
  //     })) as HexString;

  //     console.log("🔑 Reencrypting the balance handle...");
  //     await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalance = await reEncryptorForMainWallet({
  //       handle: eBalanceHandle.toString()
  //     });

  //     console.log("🎯 Decrypted Balance of Onwer:", decryptedBalance.value);
  //     expect(decryptedBalance.value).to.equal(plainTextAmount);
  //   });
  // });

  // describe("Decryption Tests", function () {
  //   it("It should send 1000 cUSDC from owner to alice and then decrypt Alice's balance", async function () {
  //     // Minting 5000 cUSDC
  //     console.log("\n------ 💰 Minting 5000 cUSDC for Owner ------");
  //     const plainTextAmountToMint = parseEther("5000");

  //     const txHashForMint = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: contractAbi.abi,
  //       functionName: "mint",
  //       args: [plainTextAmountToMint],
  //     });
  //     await publicClient.waitForTransactionReceipt({ hash: txHashForMint });
  //     console.log("✅ Mint successful: 5000 cUSDC added to Owner's balance.");

  //     // Fetch Owner's Balance
  //     console.log("\n------ 🔍 Fetching Balance Handle for Owner ------");
  //     const eBalanceHandleForOwnerAfterMint = (await publicClient.readContract({
  //       address: getAddress(contractAddress),
  //       abi: contractAbi.abi,
  //       functionName: "balanceOf",
  //       args: [wallet.account.address],
  //     })) as HexString;
  //     await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalanceForOwnerAfterMint = await reEncryptorForMainWallet({
  //       handle: eBalanceHandleForOwnerAfterMint.toString()
  //     });

  //     console.log(
  //       `🎯 Decrypted Owner Balance: ${decryptedBalanceForOwnerAfterMint.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForOwnerAfterMint.value).to.equal(
  //       plainTextAmountToMint
  //     ); // ✅ Assertion

  //     // Encrypt 1000 cUSDC for Transfer
  //     const plainTextAmountToBeSent = parseEther("1000");
  //     console.log("\n------ 🔄 Encrypting Transfer Amount (1000 cUSDC) ------");
  //     const encryptedCipherText = await incoConfig.encrypt(plainTextAmountToBeSent,{
  //       accountAddress: wallet.account.address,
  //       dappAddress: contractAddress,
  //     });
  //     console.log("✅ Encryption successful.");

  //     // Transfer 1000 cUSDC from Owner to Alice
  //     console.log(
  //       `\n------ 📤 Transferring 1000 cUSDC from Owner to Alice ------`
  //     );
  //     const transferFunctionAbi = contractAbi.abi.find(
  //       (item) =>
  //         item.name === "transfer" &&
  //         item.inputs.length === 2 &&
  //         item.inputs[1].type === "bytes"
  //     );
  //     const txHashForTransfer = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: [transferFunctionAbi],
  //       functionName: "transfer",
  //       args: [
  //         namedWallets.alice.account.address,
  //         encryptedCipherText,
  //       ],
  //     });
  //     await publicClient.waitForTransactionReceipt({ hash: txHashForTransfer });
  //     console.log("✅ Transfer successful: 1000 cUSDC sent to Alice.");

  //     // Fetch Owner's Balance After Transfer
  //     console.log("\n------ 🔍 Fetching Updated Balance for Owner ------");
  //     const eBalanceHandleForOwnerAfterTransfer =
  //       (await publicClient.readContract({
  //         address: getAddress(contractAddress),
  //         abi: contractAbi.abi,
  //         functionName: "balanceOf",
  //         args: [wallet.account.address],
  //       })) as HexString;
  //       await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalanceForOwnerAfterTransfer = await reEncryptorForMainWallet({
  //       handle: eBalanceHandleForOwnerAfterTransfer.toString()
  //     });

  //     console.log(
  //       `🎯 Decrypted Owner Balance After Transfer: ${decryptedBalanceForOwnerAfterTransfer.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForOwnerAfterTransfer.value).to.equal(
  //       parseEther("4000")
  //     ); // ✅ Assertion

  //     // Fetch Alice's Balance After Transfer
  //     console.log("\n------ 🔍 Fetching Balance Handle for Alice ------");
  //     const eBalanceHandleForAliceAfterTransfer =
  //       (await publicClient.readContract({
  //         address: getAddress(contractAddress),
  //         abi: contractAbi.abi,
  //         functionName: "balanceOf",
  //         args: [namedWallets.alice.account.address],
  //       })) as HexString;
  //       await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the transfer to be processed 
  //     const decryptedBalanceForAliceAfterTransfer = await reEncryptorForAliceWallet({
  //       handle: eBalanceHandleForAliceAfterTransfer.toString()
  //     });

  //     console.log(
  //       `🎯 Decrypted Alice Balance: ${decryptedBalanceForAliceAfterTransfer.value} cUSDC`
  //     );
  //     expect(decryptedBalanceForAliceAfterTransfer.value).to.equal(
  //       parseEther("1000")
  //     ); // ✅ Assertion

  //     console.log(
  //       "\n------ 🔑 Requesting Decryption of Alice's Balance ------"
  //     );

  //     const txHashForDecryption = await wallet.writeContract({
  //       address: contractAddress,
  //       abi: contractAbi.abi,
  //       functionName: "requestUserBalanceDecryption",
  //       args: [namedWallets.alice.account.address], // Passing Alice's address for decryption
  //     });

  //     await publicClient.waitForTransactionReceipt({
  //       hash: txHashForDecryption,
  //     });
  //     console.log(`✅ Decryption request sent for Alice's balance.`);

  //     // 🛑 **Wait for `UserBalanceDecrypted` Event**
  //     console.log(
  //       "\n------ 🛑 Waiting for `UserBalanceDecrypted` Event ------"
  //     );

  //     const eventPromise = new Promise((resolve, reject) => {
  //       const unwatch = publicClient.watchEvent({
  //         address: getAddress(contractAddress),
  //         event: parseAbiItem(
  //           "event UserBalanceDecrypted(address user, uint256 decryptedAmount)"
  //         ),
  //         onLogs: (logs) => {
  //           console.log("📢 Event detected:", logs);

  //           if (logs.length > 0) {
  //             // Extract decrypted balance from `logs[0].data`
  //             const decryptedBalanceHex = logs[0].data;
  //             const decryptedBalance = BigInt(decryptedBalanceHex); // Convert to BigInt
  //             resolve(decryptedBalance);
  //           }
  //         },
  //         onError: (error) => {
  //           console.error("❌ Error watching event:", error.message);
  //           reject(error);
  //         },
  //       });

  //       setTimeout(() => {
  //         unwatch();
  //         reject(new Error("⏳ Event not detected within timeout"));
  //       }, 20000); // Timeout after 20 seconds
  //     });

  //     // Await the event and assert the balance
  //     const decryptedBalanceForAlice = await eventPromise;
  //     console.log(
  //       `🎯 Decrypted Alice Balance: ${decryptedBalanceForAlice} cUSDC`
  //     );

  //     expect(decryptedBalanceForAlice).to.equal(parseEther("1000")); // ✅ Assertion
  //   });
  // });


});