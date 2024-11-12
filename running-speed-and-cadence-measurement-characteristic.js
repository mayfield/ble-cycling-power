const bleno = require('./bleno');


class RSCFeatureCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A54',
            properties: ['read'],
            value: Buffer.from([0b100, 0]),
        });
    }
}


class RSCMeasurementCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A53',
            properties: ['read', 'notify'],
        });
        this._updateValueCallback = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('[BLE] client subscribed to RSC');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('[BLE] client unsubscribed from RSC');
        this._updateValueCallback = null;
    }

    notify(event) {
        const buffer = Buffer.alloc(4);
        // flags
        // 00000001 - 1   - 0x01 - Instantaneous Stride Length Present
        // 00000010 - 2   - 0x02 - Total Distance Present
        // 00000100 - 4   - 0x04 - Walking or Running Status
        buffer.writeUInt8(0x0 | (event.speed > 6 ? 0x4 : 0));
        if ('speed' in event) {
            // kmh -> ((meters per second) * 256)
            buffer.writeUInt16LE(Math.min(0xffff, Math.round(event.speed * 1000 / 3600 * 256)), 1);
        }
        if ('cadence' in event) {
            buffer.writeUInt8(Math.min(0xff, Math.round(event.cadence)), 3);
        }
        if (this._updateValueCallback) {
            this._updateValueCallback(buffer);
        }
    }
}

module.exports = {RSCMeasurementCharacteristic, RSCFeatureCharacteristic};
