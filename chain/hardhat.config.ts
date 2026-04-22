import "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "paris",
    },
  },
  networks: {
    ganache: {
      type: "http",
      url: "http://127.0.0.1:7545",
      accounts: [
        "0x5d6a1db234132947c8bbb4b4a64b259c1fdfd02d318213e81f881f30d9a24041"
      ],
    },
  },
});