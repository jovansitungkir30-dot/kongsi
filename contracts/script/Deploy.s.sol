// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockIDR} from "../src/MockIDR.sol";
import {Kongsi} from "../src/Kongsi.sol";

/// forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --account <keystore>
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        MockIDR idr = new MockIDR();
        Kongsi kongsi = new Kongsi(address(idr));
        vm.stopBroadcast();
        console.log("MockIDR:", address(idr));
        console.log("Kongsi :", address(kongsi));
    }
}
