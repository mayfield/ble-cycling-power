const bcp = require('./');
const bleno = require('bleno');
const os = require('os');
const tty = require('tty');


let wattsBasis = parseInt(process.argv[2]);
const jitter = Number(process.argv[3]);
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


async function main() {
    let iterations = 0;
    let total = 0;
    let rev_count = 1;
    const powerMeter = peripheral.service.pm;
    global.powerMeter = powerMeter;
    bleno.on('accept', clientAddress => {
        console.warn('accept', clientAddress);
    });
    bleno.on('disconnect', clientAddress => {
        console.warn('disconnect', clientAddress);
    });

    /* At least with zwift things go side ways sometimes and we must reset..
     * Until we know why, we have to reset it unless it resolves itself. */
    let _unsubTime;
    let _resetTimer;
    function resetPowerMeter() {
        console.error("Unrecoverable error, must manually restart till we figure this out.");
        process.exit(1);
    }
    powerMeter.on('unsubscribe', () => {
        _unsubTime = Date.now();
        _resetTimer = setTimeout(resetPowerMeter, 5000);
    });
    powerMeter.on('subscribe', () => {
        clearTimeout(_resetTimer);
    });

    const hrRolling = rolling(20);
    const cadenceRolling = rolling(10);
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
            console.log("Increase Watts Basis:", wattsBasis);
        } else if (key === "\u001b[B") {
            wattsBasis = Math.max(0, wattsBasis - 10);
            console.log("Decrease Watts Basis:", wattsBasis);
        }
    });

    while (true) {
        const start = Date.now();
        iterations++;
        let watts = wattsBasis;
        if (signwave) {
            watts += wattsBasis * 0.2 * Math.sin(iterations / 20);
        }
        watts += jitter * (Math.random() - 0.5) * watts;
        watts = Math.max(0, Math.round(watts));
        total += watts;
        const hr = hrRolling(90 + (80 * (watts / 400)) + (Math.random() * 20));
        const gearRatio = Math.random()
        let cadence = cadenceRolling(50 + (40 * (watts / 400)) + (Math.random() * 10));
        if (bigGear) {
            cadence *= 0.75;
        }
        if (!watts) {
            cadence = 0;
        }
        if (Math.random() < 0.05) {
            bigGear = !bigGear;
        }
        console.info(`[${name}]: current: ${watts}w, avg:${Math.round(total / iterations)}w, basis:${wattsBasis}, ` +
                     `hr:${Math.round(hr)}, cadence:${Math.round(cadence)}${bigGear ? ' [Big Gear]' : ''}`);
        if (Math.random() < 0.2) {
            rev_count += 2;
        } else {
            rev_count += 1;
        }
        for (let i = 0; i < 2; i++) {
            peripheral.service.notify({
                watts,
                cadence,
                hr
            });
            await sleep(450);
        }
        const delay = 1000 - (Date.now() - start);
        await sleep(Math.round(delay));
    }
};
main();
