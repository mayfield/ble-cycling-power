const bcp = require('./');
const bleno = require('@abandonware/bleno');
const os = require('os');
const fetch = require('node-fetch');
const express = require('express');

let wattsBasis = parseInt(process.argv[2] || 100);
let cadenceBasis = 60;
let hrBasis = 105;
let speedBasis = 5;
const jitterPct = Number(process.argv[3] || 0.2);
const signwave = false;
const name = os.hostname();
const peripheral = new bcp.BluetoothPeripheral(name);


async function sauceRPC(name, ...args) {
    const r = fetch(`http://jm:1080/api/rpc/${func}`, {
        method: 'POST',
        body: JSON.stringify(args)
    });
    const env = await r.json();
    if (env.success) {
        return env.value;
    } else {
        console.error(env);
        throw new Error(env.error.name);
    }
}


function adjPower(delta, {min=0, max=1200}={}) {
    const desired = wattsBasis + delta;
    wattsBasis = Math.max(min, Math.min(max, desired));
    return wattsBasis;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function jitter(value) {
    const basis = jitterPct * value;
    return Math.round((Math.random() * basis) - (basis / 2));
}


function rolling(size) {
    let history = [];
    let i = 0;
    let sum = 0;
    return function(value) {
        sum -= history[i % size] || 0;
        sum += value;
        history[i++ % size] = value;
        return sum / history.length;
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
    let connected;
    bleno.on('accept', clientAddress => {
        warn('Connected client:', clientAddress);
        connected = true;
    });
    bleno.on('disconnect', clientAddress => {
        warn('Disconnected client:', clientAddress);
        connected = false;
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

    const webApp = express();
    webApp.use(express.json({strict: false}));
    webApp.get('/api/power', (req, res) => {
        res.json(wattsBasis);
    });
    webApp.put('/api/power', (req, res) => {
        wattsBasis = req.body;
        res.status(204);
        res.send();
    });
    webApp.listen(2080);

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
            hrBasis = Math.max(60, hrBasis - 5);
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
        if (!connected) {
            return;
        }
        iterations++;
        let watts = wattsBasis;
        if (signwave) {
            watts += wattsBasis * 0.2 * Math.sin(Date.now() / 1000 / 15);
        }
        watts = Math.max(0, Math.round(watts + jitter(watts)));
        let runSpeed = Math.max(0, speedRolling(speedBasis + (13 * (Math.min(watts, 500) / 500)) + jitter(2)));
        const hr = Math.max(0, hrRolling(hrBasis + (100 * (Math.min(watts, 500) / 500)) + jitter(50)));
        let cadence = Math.max(0, cadenceRolling(cadenceBasis + (40 * (Math.min(watts, 400) / 400)) + jitter(10)));
        if (!watts) {
            cadence = 0;
            runSpeed = 0;
        }
        if (Math.random() < 0.05) {
            bigGear = !bigGear;
        }
        const bikeCadence = bigGear ? cadence * 0.75 : cadence;
        if (unsubTime && (Date.now() - unsubTime) > 998) {
            warn('Last reading was dropped!');
            total -= lastWatts;
        }
        lastWatts = watts;
        total += watts;
        const perMile = 3600 / (runSpeed * 1000 / 1609.34);
        const runPace = `${perMile / 60 | 0}:${Math.trunc(perMile % 60).toString().padStart(2, '0')}/mi`
        console.debug(`iter:${iterations}, cur:${watts}w, avg:${Math.round(total / iterations)}w, ` +
                      `watt-basis:${wattsBasis}, hr:${Math.round(hr)}, rpm:${Math.round(bikeCadence)} ` +
                      `spm:${Math.round(cadence * 1.8)}, run-pace:${runPace} ` +
                      `${bigGear ? ' [Big Gear]' : ''}`);
        peripheral.powerService.notify({watts, cadence: bikeCadence});
        peripheral.hrService.notify({hr});
        peripheral.runningService.notify({speed: runSpeed, cadence: cadence * 1.8});
    }, 1000);
}

main();
