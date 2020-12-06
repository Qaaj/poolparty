const _ = require('lodash');
const clc = require('cli-color'),
    clear = require('clear');
const fetch = require('node-fetch');
const numbro = require('numbro');
const {Table} = require('console-table-printer');

// Example wallet
const wallets = ['0xe2a8f5e3efe04493b76501a206a0f72cebda3819']
let num = 0, STATE = {positions: {}};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const spinner = ['.', '..', '...'];

const colorFX = (num) => num > 0 ? clc.green : clc.red;

const setState = (state) => {
    STATE = {...STATE, ...state}
}

const loader = () => {
    num++;
    return spinner[num % 3]
}
const getName = (name) => {
    if(name === 'Sushiswap') return clc.cyan(name);
    if(name === 'Uniswap') return clc.magenta(name);
    return clc.green(name);
}
const round = (num, amt =1) => numbro(num).format({ mantissa: amt, thousandSeparated: true })

const updateUI = async () => {
    if (STATE.positions) {
        clear();
        const load = loader();
        const balances = { USD: 0};
        const table = new Table({
            columns: [
                {name: 'wallet', color: 'yellow', alignment: 'left', title: 'Wallet Address'}, //with alignment and color
                {name: 'address', color: 'yellow', alignment: 'left', title: 'Pool Address'}, //with alignment and color
                {name: 'name', title: 'Pool Tokens'},
                {name: 'balances', title: 'Current Balances'},
                {name: 'initialBalances', title: 'Initial Balances'},
                {name: 'delta', title: 'Delta'},
                {name: 'valueUSD', title: 'Value USD'},
            ],
        });

        Object.entries(STATE.positions).forEach(([wallet, info]) => {
            info.pairInfos.forEach((position) => {
                const startBalances = [], currentBalances=[];
                position.tokens.forEach(token => {
                    const balance = balances[token.tokenName] || 0;
                    balances[token.tokenName] = balance + token.tokenCurrentBalance;
                    currentBalances.push(`${token.tokenName}: ${round(token.tokenCurrentBalance)}`)
                    startBalances.push(`${token.tokenName}: ${round(token.tokenStartingBalance)}`)
                })
                balances.USD += position.totalValueUsd;
                table.addRow({
                    wallet: `${wallet.substr(0,8)}..`,
                    name: position.name,
                    address: `${getName(position.poolProviderName)} - ${position.address.substr(0,8)}...`,
                    balances: currentBalances.join(' / '),
                    initialBalances: startBalances.join(' / '),
                    delta: colorFX(position.netGainPct)(`USD ${round(position.netGainUsd)} (${round(position.netGainPct,2)}%)`),
                    valueUSD: numbro(position.totalValueUsd).formatCurrency({ thousandSeparated: true, mantissa: 2 }),
                });
            })
        })
        table.printTable();
        console.log('');
        console.log(`    Total value of LP positions: ${numbro(balances.USD).formatCurrency({ thousandSeparated: true, mantissa:1 })}`)
        console.log('');
        delete balances.USD;
        const totals = new Table({
            columns: [
                {name: 'token', color: 'yellow', alignment: 'left', title: 'Token'}, //with alignment and color
                {name: 'total', color: 'yellow', alignment: 'left', title: 'Total LP Holdings'}, //with alignment and color
            ],
        });
        Object.entries(balances).forEach(([token, total]) => totals.addRow({ total: round(total, 2), token }))
        totals.printTable();
        console.log('');
        // console.log(loader());
    }
    // await sleep(1000);
    // updateUI();
}

const priceFetcher = async () => {
    const ids = ['ethereum', 'bitcoin', ...Object.keys(holdings)].join('%2C');
    const data = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const json = await data.json();
    const result = {};
    Object.entries(json).map(([key, {usd: price}]) => {
        result[key] = price;
    })
    setState({prices: result})
    await sleep(10000);
    priceFetcher();
}

const poolsFetcher = async () => {
    let walletlist = wallets;
    try {
        const mywallets = require('./wallets.js');
        walletlist = mywallets;
    }catch(err){
        console.log('File not found - using fallback')
    }
    walletlist.map(async (wallet, i) => {
        await sleep(i * 4000);
        const data = await fetch(`https://api.apy.vision/portfolio/${wallet}`);
        const json = await data.json();
        setState({positions: {[wallet]: json, ...STATE.positions}});
        updateUI();
    })
}

// priceFetcher();
poolsFetcher();
updateUI();
