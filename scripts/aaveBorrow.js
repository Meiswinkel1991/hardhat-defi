const { getNamedAccounts, ethers, network } = require('hardhat');
const {getWeth, AMOUNT} = require('../scripts/getWeth');
const { networkConfig } = require("../helper-hardhat-config")

async function main() {
    // the protocoll trats everythin as an ERC20 token
    await getWeth();
    const {deployer} = await getNamedAccounts();

    console.log(deployer);

    // abi , address

    const lendingPool = await getLendingPool(deployer);

    console.log(`lending pool address: ${lendingPool.address}`);

    //deposit

    const wethTokenAddress = networkConfig[network.config.chainId].wethToken;

    // approve

    await approveErc20(wethTokenAddress,lendingPool.address,AMOUNT,deployer);
    console.log('Depositing...');
    await lendingPool.deposit(
        wethTokenAddress,
        AMOUNT,
        deployer,
        0
    );

    console.log("Deposited!");


    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    //Borrow Time!
    // how much we have borrowed
    const daiPrice = await getDaiPrice();
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1/daiPrice.toNumber());
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());
    console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI `);

    await borrowDai(
        lendingPool,
        amountDaiToBorrowWei,
        deployer
    );
    
    await getBorrowUserData(lendingPool, deployer);
    await repay(
        lendingPool,
        amountDaiToBorrowWei,
        deployer
    );
    await getBorrowUserData(lendingPool, deployer);
}

async function repay(lendingPool,amountToRepay,account) {

    const daiAddress = networkConfig[network.config.chainId].daiToken;
    await approveErc20(daiAddress, lendingPool.address, amountToRepay, account)
    const repayTx = await lendingPool.repay(
        daiAddress,
        amountToRepay,
        1,
        account
    );
    await repayTx.wait(1);
    console.log("Repaid!");

}

async function borrowDai(lendingPool,amountToBorrow,account) {

    const daiAddress = networkConfig[network.config.chainId].daiToken;

    const borrowTx = await lendingPool.borrow(
        daiAddress,
        amountToBorrow,
        1,
        0,
        account
    );

    await borrowTx.wait(1);
    console.log("You've borrowed!");

}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        'AggregatorV3Interface',
        networkConfig[network.config.chainId].daiEthPriceFeed
    );
    const price = (await daiEthPriceFeed.latestRoundData())[1];
    console.log(`The actual DAI/ETH price is ${price.toString()}`);

    return price;
}




async function getBorrowUserData(lendingPool,account) {

    const {totalCollateralETH,totalDebtETH,availableBorrowsETH} = await lendingPool.getUserAccountData(account);

    console.log(`You have ${totalCollateralETH} worth of ETH deposited`);
    console.log(`You have ${totalDebtETH} worth of ETH borrowed`);
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH `);

    return { availableBorrowsETH, totalDebtETH };
}

async function approveErc20(contractAddress,spenderAddress,amountToSpend,account) {
    const erc20Token = await ethers.getContractAt(
        'IERC20',
        contractAddress,
        account.address
    );
    
    txResponse = await erc20Token.approve(spenderAddress, amountToSpend);
    await txResponse.wait(1);
    console.log("Approved!");

}

async function getLendingPool(account) {
    const lendingPoolAddressProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        account.address
    );

    const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();

    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account.address
    );

    return lendingPool;
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });