const fetch = require('node-fetch');
const WebSocket = require('ws');
const events = require('events');

let _sauceWs;
let _sauceWsId = 0;
const _sauceEmitters = new Map();
const _sauceRequests = new Map();

async function sauceSubscribe(event) {
    let ws = _sauceWs;
    if (!ws) {
        ws = new WebSocket('ws://127.0.0.1:1080/api/ws/events');
        ws.on('close', () => {
            console.warn("Sauce websocket closed");
            if (ws === _sauceWs) {
                _sauceWs = null;
            }
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
        if (!ourGroup || groups.length < 2) {
            return;
        }
        const ourAthlete = ourGroup.athletes.find(x => x.self);
        const wBalNorm = Math.min(1, Math.max(0, ((ourAthlete.stats.wBal || 10000) / 20000) ** 0.5));
        const max = Math.max(900, curPower) * wBalNorm;
        const limits = {min: Math.min(0, curPower), max};
        const adjust = x => adjPower(curPower + x, limits);
        const prioGroups = Array.from(groups).sort((a, b) => {
            let aPrio = a.athletes.length;
            let bPrio = b.athletes.length;
            aPrio /= Math.log(2 + Math.abs(a.gap * 0.8));
            bPrio /= Math.log(2 + Math.abs(b.gap * 0.8));
            aPrio *= a.gap < 0 ? 1.15 : a.gap > 0 ? 0.9 : 1;
            bPrio *= b.gap < 0 ? 1.15 : b.gap > 0 ? 0.9 : 1;
            a.prio = aPrio;
            b.prio = bPrio;
            return bPrio - aPrio;
        });
        const targetGroup = prioGroups[0];
        console.log();
        for (const x of prioGroups) {
            const offt = groups.indexOf(ourGroup);
            console.log((groups.indexOf(x) - offt).toString().padStart(3),
                        'prio:', ''.padStart(x.prio / Math.max(prioGroups[0].prio, 15) * 30, '#').padEnd(30),
                        x.prio.toFixed(1).padStart(4), 'size:', x.athletes.length.toString().padStart(3),
                        'gap:', x.gap.toFixed(0));
        }
        if (ourGroup === targetGroup) {
            if (ourGroup.athletes.length < 2) {
                return;
            }
            const speedDelta = ourAthlete.state.speed - ourGroup.speed;
            const powerDelta = ourGroup.power / Math.max(1, ourAthlete.state.power);
            if (speedDelta > 2) {
                console.warn("Slowing down to avoid overshooting:", adjust(speedDelta * -6));
            } else if (speedDelta < -2) {
                console.error("Speeding up to avoid getting dropped:", adjust(speedDelta * -6));
            } else {
                const ourPos = ourGroup.athletes.findIndex(x => x.self);
                const placement = ourPos / (ourGroup.athletes.length - 1);
                if (placement < 0.5) {
                    console.warn("Slide back:", adjust((0.5 - placement) / 0.5 * powerDelta * -2).toFixed(1));
                } else {
                    console.error("Nudge forward:", adjust((placement - 0.5) / 0.5 * powerDelta * 2).toFixed(1));
                }
            }
        } else {
            const gIndex = groups.indexOf(ourGroup);
            const targetIndex = groups.indexOf(targetGroup);
            const dir = targetIndex < gIndex ? 1 : -1;
            const speedDelta = ourAthlete.state.speed - targetGroup.speed;
            const gap = Math.abs(targetGroup.gap - ourGroup.gap);
            const targetSpeed = targetGroup.speed + dir + (Math.min(10, gap * 0.25) * dir);
            const powerDelta = Math.max(-4, Math.min(10, targetSpeed - ourAthlete.state.speed)) ** 2 *
                Math.sign(targetSpeed - ourAthlete.state.speed);
            console.log({targetSpeed, powerDelta, dir, gap}, 'ourspeed', ourAthlete.state.speed);
            const power = adjust(powerDelta);
            if (dir > 0) {
                if (powerDelta < 0) {
                    console.warn("Throttle back chase:", power.toFixed(1));
                } else {
                    console.error("Increasing chase effort:", power.toFixed(1));
                }
            } else {
                if (powerDelta < 0) {
                    console.warn("Slowing for group behind:", power.toFixed(1));
                } else {
                    console.error("Speeding up to avoid overtake:", power.toFixed(1));
                }
            }
        }
    });
}

main();
