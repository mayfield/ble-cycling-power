const bcp = require('./');
const bleno = require('bleno');
const os = require('os');


let wattsBasis = parseInt(process.argv[2] || 100);
let cadenceBasis = 60;
let hrBasis = 80;
let speedBasis = 5;
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
    const powerMeter = peripheral.powerService.pm;
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

    const hrRolling = rolling(40);
    const speedRolling = rolling(8);
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
            cadenceBasis = Math.min(200, cadenceBasis + 5);
            console.log("Increase cadence basis:", cadenceBasis);
        } else if (key === "C") {
            cadenceBasis = Math.max(0, cadenceBasis - 5);
            console.log("Decrease cadence basis:", cadenceBasis);
        } else if (key === "h") {
            hrBasis = Math.min(120, hrBasis + 5);
            console.log("Increase HR basis:", hrBasis);
        } else if (key === "H") {
            hrBasis = Math.max(40, hrBasis - 5);
            console.log("Decrease HR basis:", hrBasis);
        } else if (key === "s") {
            speedBasis = Math.min(10, speedBasis + 0.25);
            console.log("Increase Run Speed basis:", speedBasis);
        } else if (key === "S") {
            speedBasis = Math.max(1, speedBasis - 0.25);
            console.log("Decrease Run Speed basis:", speedBasis);
        }
    });

    let lastWatts;
    setInterval(() => {
        iterations++;
        let watts = wattsBasis;
        if (signwave) {
            watts += wattsBasis * 0.2 * Math.sin(Date.now() / 1000 / 15);
        }
        watts += jitter * (Math.random() - 0.5) * watts;
        watts = Math.max(0, Math.round(watts));
        let runSpeed = speedRolling(speedBasis + (12 * (Math.min(watts, 500) / 500)) + (Math.random() * 1));
        const hr = hrRolling(hrBasis + (90 * (Math.min(watts, 500) / 500)) + (Math.random() * 20));
        let cadence = cadenceRolling(cadenceBasis + (40 * (Math.min(watts, 400) / 400)) + (Math.random() * 10));
        if (bigGear) {
            cadence *= 0.75;
        }
        if (!watts) {
            cadence = 0;
            runSpeed = 0;
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
                     `watt-basis:${wattsBasis}, hr:${Math.round(hr)}, cadence:${Math.round(cadence)} ` +
                     `run-speed:${Math.round(runSpeed)} ${bigGear ? ' [Big Gear]' : ''}`);
        peripheral.powerService.notify({watts, cadence});
        peripheral.hrService.notify({hr});
        peripheral.runningService.notify({speed: runSpeed, cadence: cadence * 1.8 / (bigGear ? 0.75 : 1)});
    }, 1000);
}

main().catch(() => process.exit(1));
