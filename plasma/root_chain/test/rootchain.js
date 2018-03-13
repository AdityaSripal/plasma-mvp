var RootChain = artifacts.require("RootChain");
var RLP = require('rlp');

contract('RootChain', accounts => {
    it("Submit block from authority passes", () => {
        return RootChain.deployed().then(async (instance) => {
            var curr = await instance.currentChildBlock.call().then(x => {return parseInt(x)})
            
            // waiting at least 6 root chain blocks before submitting a block
            for (i = 0; i < 5; i++) {
                await web3.eth.sendTransaction({'from': accounts[0], 'to': accounts[1], 'value': 100});
            }

            var blockRoot = '2984748479872';
            await instance.submitBlock(web3.fromAscii(blockRoot));
            var next = await instance.currentChildBlock.call().then(y => {return parseInt(y)})
            assert.equal(curr + 1, next, "Child block did not increment");

            var childBlock = await instance.getChildChain.call(curr);
            assert.equal(web3.toUtf8(childBlock[0]), blockRoot, 'Child block merkle root does not match submitted merkle root.');
        });
    });
    it("Depositing a block passes", () => {
        return RootChain.deployed().then(async (instance) => {
            //Why does this work? David's implementation requires txBytes to have length 11
            var depositAmount = 50000;
            var txBytes = RLP.encode([0, 0, 0, 0, 0, 0, accounts[2], depositAmount, 0, 0, 0]);
            var prev =  await instance.currentChildBlock.call().then(x => {return parseInt(x)})

            var result = await instance.deposit(txBytes.toString('binary'), {'from': accounts[2], 'value': depositAmount}).then(res => {return res});
            assert.equal(result.logs[0].args.depositor, accounts[2], 'Deposit event does not match depositor address.');
            assert.equal(parseInt(result.logs[0].args.amount), depositAmount, 'Deposit event does not match deposit amount.');

            var curr = await instance.currentChildBlock.call().then(x => {return parseInt(x)})
            assert.equal(prev + 1, curr, "Child block did not increment")
            // TODO: check correctness of newly created merkle root
        });
    });
    it("Invalid deposits fail", () => {
        return RootChain.deployed().then(async (instance) => {
            var txBytes = RLP.encode([0, 0, 0, 0, 0, 0, accounts[2], 50000, 0, 0, 0]);
            promiseToThrow(instance.deposit(txBytes.toString('binary'), {'from': accounts[2], 'value': 50}), "Invalid deposit did not revert")

            var txBytes2 = RLP.encode([0, 0, 0, 0, 0, 0, accounts[2], 50000, accounts[3], 10000, 0]);
            promiseToThrow(instance.deposit(txBytes2.toString('binary'), {'from': accounts[2], 'value': 50000}), "Invalid deposit did not revert")

            var txBytes3 = RLP.encode([3, 5, 0, 0, 0, 0, accounts[2], 50000, 0, 0, 0]);
            promiseToThrow(instance.deposit(txBytes3.toString('binary'), {'from': accounts[2], 'value': 50000}), "Invalid deposit did not revert")
        })
    })
    it("Submit block from someone other than authority fails", () => {
        return RootChain.deployed().then(async (instance) => {
            for (i = 0; i < 5; i++) {
                await web3.eth.sendTransaction({'from': accounts[0], 'to': accounts[1], 'value': 100});
            }
            var prev = await instance.currentChildBlock.call().then(x => {return parseInt(x)})
            promiseToThrow(instance.submitBlock('496934090963', {'from': accounts[1]}), "Submit allowed from wrong person");
            var curr = await instance.currentChildBlock.call().then(x => {return parseInt(x)})
            assert.equal(prev, curr, "Allowed submit block from someone other than authority!");
        });
    });
    it("Submit block within 6 rootchain blocks fails", () => {
        return RootChain.deployed().then(async (instance) => {
            // First submission waits and passes
            for (i = 0; i < 5; i++) {
                await web3.eth.sendTransaction({'from': accounts[0], 'to': accounts[1], 'value': 100});
            }
            var blockRoot1 = '2984748479872';
            await instance.submitBlock(web3.fromAscii(blockRoot1));

            // Second submission does not wait and therfore fails.
            for (i = 0; i < 3; i++) {
                await web3.eth.sendTransaction({'from': accounts[0], 'to': accounts[1], 'value': 100});
            }
            var blockRoot2 = '8473748479872';
            promiseToThrow(instance.submitBlock(web3.fromAscii(blockRoot2)), "Submit does not wait 6 rootchain blocks.");
        });
    });
});

// Function from Jeremiah Andrews
function promiseToThrow(p, msg) {
    return p.then(_ => false).catch(_ => true).then(res => assert(res, msg));
}

