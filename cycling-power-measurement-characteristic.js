const bleno = require('@abandonware/bleno');


class CyclingPowerMeasurementCharacteristic extends bleno.Characteristic {
    constructor(options) {
        super({
            uuid: '2A63',
            properties: ['read', 'notify'],
        });
        this._updateValueCallback = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('[BLE] client subscribed to PM');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('[BLE] client unsubscribed from PM');
        this._updateValueCallback = null;
    }

    notify(event) {
        const buffer = Buffer.alloc(8);
        // flags
        // 00000001 - 1   - 0x001 - Pedal Power Balance Present
        // 00000010 - 2   - 0x002 - Pedal Power Balance Reference
        // 00000100 - 4   - 0x004 - Accumulated Torque Present
        // 00001000 - 8   - 0x008 - Accumulated Torque Source
        // 00010000 - 16  - 0x010 - Wheel Revolution Data Present
        // 00100000 - 32  - 0x020 - Crank Revolution Data Present
        buffer.writeUInt16LE(0x020);
        if ('watts' in event) {
            buffer.writeInt16LE(Math.min(0xffff, Math.round(event.watts)), 2);
        }
        let revCount;
        let revTime;
        if ('cadence' in event) {
            const rps = event.cadence / 60;
            if (!this._lastRevCount) {
                revCount = 1;
                revTime = 1 / rps;
            } else {
                revCount = this._lastRevCount + 1;
                revTime = this._lastRevTime + (1 / rps);
            }
            this._lastRevCount = revCount;
            this._lastRevTime = revTime;
        }
        if (revCount !== undefined) {
            buffer.writeUInt16LE(revCount & 0xffff, 4);
            const btTime = Math.round(revTime * 1024) & 0xffff;
            buffer.writeUInt16LE(btTime, 6);
        }
        if (this._updateValueCallback) {
            this._updateValueCallback(buffer);
        }
    }
}

module.exports = CyclingPowerMeasurementCharacteristic;
