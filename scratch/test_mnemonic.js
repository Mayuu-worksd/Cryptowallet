const { ethers } = require('ethers');

const p1 = "ask intact village address soon margin jaguar range funny around burden sight";
const p2 = "seminar property jewel material stereo budget fiction pizza holiday relax lunar cart";

function check(p) {
    try {
        const wallet = ethers.Wallet.fromMnemonic(p);
        console.log(`Valid: ${p} -> ${wallet.address}`);
    } catch (e) {
        console.log(`Invalid: ${p} -> ${e.message}`);
    }
}

check(p1);
check(p2);
