const fetch = require('node-fetch');
const process = require('node:process');
const WebSocket = require('ws');
const events = require('events');
const HOST = 'localhost';
const PORT = 1080;

const sauceURL = `ws://${HOST}:${PORT}/api/ws/events`;

let _sauceWs;
let _sauceWsId = 0;
const _sauceEmitters = new Map();
const _sauceRequests = new Map();

const stayInGroup = process.argv.includes('--stay-in-group');
if (stayInGroup) process.argv.splice(process.argv.indexOf('--stay-in-group'), 1);
if (process.argv.includes('--help') || process.argv.length > 2) {
    console.log(`Usage: ${process.argv[1]} [--stay-in-group]`);
    process.exit(1);
}

if (stayInGroup) {
    console.info("\nUsing Stay In Group Mode...\n");
} else {
    console.warn("\nUsing WIN Mode...\n");
}


function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}


async function connectWebSocket(emitter, event) {
    while (true) {
        ws = new WebSocket(sauceURL);
        ws.on('message', buf => {
            const msg = JSON.parse(buf);
            if (msg.type === 'event') {
                if (msg.success) {
                    emitter.emit('data', msg.data);
                } else {
                    console.error("event error", msg);
                    emitter.emit('error', msg);
                }
            }
        });
        await new Promise((resolve, reject) => {
            ws.on('error', reject);
            ws.on('open', resolve);
        });
        console.log("Sauce websocket connected:", sauceURL);
        _sauceWsId++;
        const uid = `req-${_sauceWsId}`;
        const subId = `sub-${_sauceWsId}`;
        ws.send(JSON.stringify({
            type: "request",
            uid,
            data: {
                method: "subscribe",
                arg: {
                    event,
                    subId,
                }
            }
        }));
        return ws;
    }
}


function sauceSubscribe(event) {
    const emitter = new events.EventEmitter();
    async function monitor() {
        while (true) {
            let ws;
            try {
                ws = await connectWebSocket(emitter, event);
            } catch(e) {
                console.error("connect error: retry in 2 seconds...");
                await sleep(2000);
                continue;
            }
            const code = await new Promise(resolve => {
                ws.on('close', resolve);
            });
            console.warn("Sauce websocket closed:", code);
            await sleep(2000);
        }
    }
    monitor();
    console.log("Sauce ws subscribed to:", event);
    return emitter;
}


async function botAPI(name, options={}) {
    const r = await fetch(`http://127.0.0.1:2080/api/${name}`, {
        headers: {"content-type": "application/json"},
        ...options,
        method: options.method || options.json !== undefined ? 'PUT' : 'GET',
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    });
    if (r.status !== 204) {
        return await r.json();
    }
}


function adjPower(power, {min=0, max=1200}={}) {
    power = Math.max(min, Math.min(max, power));
    botAPI('power', {json: power < 60 ? 0 : power});
    return power;
}


async function main() {
    const sauceGroups = sauceSubscribe('groups');
    let refPower = 0; // store internal intent during small power (< 60) coasting
    sauceGroups.on('data', async groups => {
        const curPower = await botAPI('power');
        if (curPower) {
            refPower = curPower;
        }
        const ourGroup = groups.find(x => x.athletes.some(x => x.self));
        if (!ourGroup || !ourGroup.speed) {
            return;
        }
        groups = groups.filter(x => Math.abs(x.gap) < 90);
        const ourAthlete = ourGroup.athletes.find(x => x.self);
        const ftp = ourAthlete.athlete?.ftp || 200;
        const wPrime = (ourAthlete.athlete?.wPrime || 20000);
        const wBal = Math.round(ourAthlete.stats.wBal || 10000);
        const wBalAdj = Math.round(wBal - Math.min(wPrime * 0.75, ourAthlete.state.time * 1.5));
        const wBalNorm = Math.round(Math.min(1, Math.max(0, (wBalAdj / wPrime))) * 25) / 25;
        const max = Math.round(Math.min(1200, refPower) * wBalNorm + (ftp / 2));
        //console.log({wBal, wBalAdj, wBalNorm, wPrime, max, ftp});
        const limits = {min: Math.min(0, refPower), max};
        const adjust = (d, reason) => {
            const pwr = adjPower(refPower + d, limits);
            console.log(`max: ${max}, wBal: ${wBal}, wBalAdj: ${wBalAdj-wBal}, wBalNorm: ${wBalNorm}`);
            console.log(`${d ? d > 0 ? '+' : '' : '+'}${d.toFixed(1)}w (${pwr.toFixed(0)}w): ${reason}`);
            return pwr;
        };
        const setPower = (p, reason) => {
            const pwr = adjPower(p, limits);
            console.log(`max: ${max}, wBal: ${wBal}, wBalAdj: ${wBalAdj-wBal}, wBalNorm: ${wBalNorm}`);
            console.log(`${p.toFixed(1)}w (${pwr.toFixed(0)}w): ${reason}`);
            return pwr;
        };
        if (!stayInGroup) {
            for (const x of groups) {
                x.prio = Math.log2(1 + x.athletes.length) ** 2;
                if (x.gap) {
                    if (x.gap < 0) {
                        x.prio *= (30 / -x.gap);
                    } else {
                        x.prio *= (5 / x.gap);
                    }
                } else {
                    x.prio *= 2;
                }
            }
        } else {
            for (const x of groups) {
                const gapFactor = 0.5;
                x.prio = (x.athletes.length) * (gapFactor * (1 / Math.log1p(Math.abs(x.gap) + 1)));
            }
        }
        const prioGroups = Array.from(groups).sort((a, b) => b.prio - a.prio);
        const targetGroup = prioGroups[0];
        console.log();
        console.log('------------------------------------------------------');
        console.log();
        console.log('POS |                      PRIO |  SZ |   GAP |    SPD');
        for (const x of prioGroups.slice(0, 5)) {
            const offt = groups.indexOf(ourGroup);
            console.log((groups.indexOf(x) - offt).toString().padStart(3),
                        '|', ''.padStart(x.prio / Math.max(prioGroups[0].prio, 15) * 20, '#').padEnd(20),
                             x.prio.toFixed(1).padStart(4),
                        '|', x.athletes.length.toString().padStart(3),
                        '|', x.gap.toFixed(0).padStart(4) + 's',
                        '|', x.speed.toFixed(0).padStart(3) + 'kph'
            );
        }
        console.log();
        if (ourGroup === targetGroup) {
            if (ourGroup.athletes.length < 2) {
                setPower(ftp / 2, 'Solo Z2 ride');
                return;
            }
            const speedDelta = ourAthlete.state.speed - ourGroup.speed;
            const powerDelta = ourGroup.power / Math.max(1, ourAthlete.state.power);
            //console.log({powerDelta, speedDelta, speedDelta, os: ourAthlete.state.speed, gs: ourGroup.speed});
            if (speedDelta > 1.5) {
                adjust(speedDelta * -10, 'Slowing down to avoid breakaway');
            } else if (speedDelta < -1.5) {
                adjust(speedDelta * -12, 'Speeding up to avoid getting dropped');
            } else {
                const ourPos = ourGroup.athletes.findIndex(x => x.self);
                const placement = ourPos / (ourGroup.athletes.length - 1);
                if (placement < 0.3) {
                    if (speedDelta < -0.4) {
                        adjust(0, 'Paused slide back to avoid getting dropped');
                    } else {
                        adjust((0.5 - placement) / 0.5 * powerDelta * -2.5, 'Slide back');
                    }
                } else if (placement > 0.7) {
                    if (speedDelta > 0.2) {
                        adjust(0, 'Paused nudge forward to avoid overshoot');
                    } else {
                        adjust((placement - 0.5) / 0.5 * powerDelta * 2.5, 'Nudge forward'); 
                    }
                } else {
                    adjust(0, 'Perfect');
                }
            }
        } else {
            const gIndex = groups.indexOf(ourGroup);
            const targetIndex = groups.indexOf(targetGroup);
            const dir = targetIndex < gIndex ? 1 : -1;
            const gap = Math.abs(targetGroup.gap - ourGroup.gap);
            const targetSpeed = targetGroup.speed + dir + (Math.min(10, gap * 0.25) * dir);
            let powerDelta;
            const targetGap = ourGroup.gap - targetGroup.gap;
            const speedDelta = targetSpeed - ourAthlete.state.speed;
            if (Math.abs(targetGap < 14)) {
                powerDelta = Math.max(-20, Math.min(20, Math.abs(speedDelta) ** 1.5 * Math.sign(speedDelta)));
            } else {
                powerDelta = Math.max(-10, Math.min(10, Math.abs(speedDelta) ** 1.1 * Math.sign(speedDelta)));
            }
            //console.log({powerDelta, speedDelta, speedDelta, os: ourAthlete.state.speed, gs: ourGroup.speed});
            //console.log({targetSpeed, powerDelta, dir, gap}, 'ourspeed', ourAthlete.state.speed);
            let reason;
            if (dir > 0) {
                if (powerDelta < 0) {
                    reason = 'Throttle back chase';
                } else {
                    reason = 'Increasing chase effort';
                }
            } else {
                if (powerDelta < 0) {
                    reason = 'Slowing for group behind';
                } else {
                    reason = 'Speeding up to avoid overtake';
                }
            }
            adjust(powerDelta, reason);
        }
    });
}

main();
