const fetch = require('node-fetch');
const WebSocket = require('ws');
const events = require('events');
const HOST = 'jmlaptop.local';
const PORT = 1080;

const sauceURL = `ws://${HOST}:${PORT}/api/ws/events`;

let _sauceWs;
let _sauceWsId = 0;
const _sauceEmitters = new Map();
const _sauceRequests = new Map();

async function sauceSubscribe(event) {
    let ws = _sauceWs;
    if (!ws) {
        ws = new WebSocket(sauceURL);
        ws.on('close', code => {
            console.warn("Sauce websocket closed:", code);
            process.exit(1);
            /*if (ws === _sauceWs) {
                _sauceWs = null;
            }*/
        });
        ws.on('message', buf => {
            const msg = JSON.parse(buf);
            if (msg.type === 'response') {
                const {resolve, reject} = _sauceRequests.get(msg.uid);
                _sauceRequests.delete(msg.uid);
                if (msg.success) {
                    resolve();
                } else {
                    console.error('sauce sub req error', msg);
                    debugger;
                    reject(new Error('sub error'));
                }
            } else if (msg.type === 'event') {
                const emitter = _sauceEmitters.get(msg.uid);
                if (msg.success) {
                    emitter.emit('data', msg.data);
                } else {
                    console.error("event error", msg);
                    emitter.emit('error', msg);
                }
            } else {
                console.error('unexpected type', msg);
                debugger;
            }
        });
        await new Promise((resolve, reject) => {
            ws.on('error', reject);
            ws.on('open', resolve);
        });
        console.log("Sauce websocket connected:", sauceURL);
        _sauceWs = ws;
    }
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
    const subReq = new Promise((resolve, reject) => _sauceRequests.set(uid, {resolve, reject}));
    const emitter = new events.EventEmitter();
    _sauceEmitters.set(subId, emitter);
    await subReq;
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
    if (power < 30) {
        power = 0; // small numbers are suspect
    }
    botAPI('power', {json: power});
    return power;
}




async function main() {
    const sauceGroups = await sauceSubscribe('groups');
    sauceGroups.on('data', async groups => {
        const curPower = await botAPI('power');
        const ourGroup = groups.find(x => x.athletes.some(x => x.self));
        if (!ourGroup || !ourGroup.speed) {
            return;
        }
        const ourAthlete = ourGroup.athletes.find(x => x.self);
        const ftp = ourAthlete.athlete?.ftp || 200;
        const wPrime = (ourAthlete.athlete?.wPrime || 20000);
        const wBal = Math.round(ourAthlete.stats.wBal || 10000);
        const wBalAdj = Math.round(wBal - Math.min(wPrime * 0.75, ourAthlete.state.time * 1.5));
        const wBalNorm = Math.round(Math.min(1, Math.max(0, (wBalAdj / wPrime))) * 25) / 25;
        const max = Math.round(Math.max(1200, curPower) * wBalNorm + (ftp / 2));
        console.log({wBal, wBalAdj, wBalNorm, wPrime, max, ftp});
        const limits = {min: Math.min(0, curPower), max};
        const adjust = (d, reason) => {
            const pwr = adjPower(curPower + d, limits);
            console.log(`[max: ${max}, wBal: ${wBal}, wBalAdj: ${wBalAdj-wBal}, wBalNorm: ${wBalNorm}]`);
            console.log(`${d ? d > 0 ? '+' : '' : '+'}${d.toFixed(1)}w (${pwr.toFixed(0)}w): ${reason}`);
            return pwr;
        };
        for (const x of groups) {
            x.prio = Math.log2(1 + x.athletes.length);
            x.prio *= x.gap < 0 ? 30 / -x.gap : x.gap > 0 ? 5 / x.gap : 2;
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
                adjust(Math.random() > 0.98 ? 1000 : Math.random() * 100, 'Solo time trial');
                return;
            }
            const speedDelta = ourAthlete.state.speed - ourGroup.speed;
            const powerDelta = ourGroup.power / Math.max(1, ourAthlete.state.power);
            //console.log({powerDelta, speedDelta, speedDelta, os: ourAthlete.state.speed, gs: ourGroup.speed});
            if (speedDelta > 1.5) {
                adjust(speedDelta * -4, 'Slowing down to avoid overshooting');
            } else if (speedDelta < -1.5) {
                adjust(speedDelta * -6, 'Speeding up to avoid getting dropped');
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
            const speedDelta = targetSpeed - ourAthlete.state.speed;
            const powerDelta = Math.max(-4, Math.min(10, Math.abs(speedDelta) ** 1.5 * Math.sign(speedDelta)));
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
