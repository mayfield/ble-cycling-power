const bcp = require('./');
const bleno = require('bleno');
const os = require('os');


let wattsBasis = parseInt(process.argv[2] || 100);
let cadenceBasis = 60;
const jitter = Number(process.argv[3] || 0.2);
const signwave = !!process.argv[4];
const name = os.hostname();
const peripheral = new bcp.BluetoothPeripheral(name);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function rolling(windowSize) {
    let history = [];
    return function(value) {
        while (history.length < windowSize) {
            history.push(value);
        }
        history.unshift(value);
        history.length = windowSize;
        return history.reduce((agg, x) => agg + x, 0) / history.length;
    };
}


function warn() {
    const now = new Date();
    const args = [`\n${now.toLocaleTimeString()}.${now.getMilliseconds()}:`].concat(Array.from(arguments));
    args.push('\n');
    console.warn.apply(console, args);
}


async function main() {
    let iterations = 0;
    let total = 0;
    const powerMeter = peripheral.service.pm;
    global.powerMeter = powerMeter;
    bleno.on('accept', clientAddress => {
        warn('Connected client:', clientAddress);
    });
    bleno.on('disconnect', clientAddress => {
        warn('Disconnected client:', clientAddress);
    });

    /* At least with zwift things go side ways sometimes and we must reset..
     * Until we know why, we have to reset it unless it resolves itself. */
    let unsubTime;
    let resetTimer;
    function resetPowerMeter() {
        console.error(`\nUnrecoverable error! ${new Date()}\n`);
        process.exit(1);
    }
    powerMeter.on('unsubscribe', () => {
        warn('Unsubscribed!');
        unsubTime = Date.now();
        resetTimer = setTimeout(resetPowerMeter, 4500);
    });
    powerMeter.on('subscribe', () => {
        warn('Subscribed');
        unsubTime = null;
        clearTimeout(resetTimer);
    });

    const hrRolling = rolling(20);
    const cadenceRolling = rolling(8);
    let bigGear = false;

    const stdin = process.openStdin(); 
    stdin.setRawMode(true);
    stdin.setEncoding('ascii');
    stdin.on('data', key => {
        if (key === '\u0003') {
            stdin.setRawMode(false);
            process.exit(1);
            return;
        } else if (key === "\u001b[A") {
            wattsBasis = Math.min(1200, wattsBasis + 10);
            console.log("Increase watts basis:", wattsBasis);
        } else if (key === "\u001b[B") {
            wattsBasis = Math.max(0, wattsBasis - 10);
            console.log("Decrease watts basis:", wattsBasis);
        } else if (key === "c") {
            cadenceBasis = Math.min(300, cadenceBasis + 5);
            console.log("Increase cadence basis:", cadenceBasis);
        } else if (key === "C") {
            cadenceBasis = Math.max(0, cadenceBasis - 5);
            console.log("Decrease cadence basis:", cadenceBasis);
        }
    });

    let lastWatts;
    while (true) {
        const start = Date.now();
        iterations++;
        let watts = wattsBasis;
        if (signwave) {
            watts += wattsBasis * 0.2 * Math.sin(Date.now() / 1000 / 15);
        }
        watts += jitter * (Math.random() - 0.5) * watts;
        watts = Math.max(0, Math.round(watts));
        const hr = hrRolling(90 + (80 * (watts / 400)) + (Math.random() * 20));
        let cadence = cadenceRolling(cadenceBasis + (40 * (watts / 400)) + (Math.random() * 10));
        if (bigGear) {
            cadence *= 0.75;
        }
        if (!watts) {
            cadence = 0;
        }
        if (Math.random() < 0.05) {
            bigGear = !bigGear;
        }
        if (unsubTime && (Date.now() - unsubTime) > 998) {
            warn('Last reading was dropped!');
            total -= lastWatts;
        }
        lastWatts = watts;
        total += watts;
        console.info(`[${name}]: iter:${iterations}, cur:${watts}w, avg:${Math.round(total / iterations)}w, ` +
                     `basis:${wattsBasis}, hr:${Math.round(hr)}, cadence:${Math.round(cadence)}` +
                     `${bigGear ? ' [Big Gear]' : ''}`);
        for (let i = 0; i < 3; i++) {
            peripheral.service.notify({
                watts,
                cadence,
                hr
            });
            await sleep(249);
        }

        const delay = 1000 - (Date.now() - start);
        await sleep(Math.round(delay));
    }
}

main().catch(() => process.exit(1));
