import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const HealthChain = await ethers.getContractFactory("HealthChain");
  const hc = await HealthChain.deploy();
  await hc.waitForDeployment();

  const addr = await hc.getAddress();
  console.log("Contract deployed to:", addr);

  await (await hc.setInitialAdmin(deployer.address)).wait();
  console.log("Initial admin set:", deployer.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});