const bleno = require('@abandonware/bleno');


class HeartRateMeasurementCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A37',
            properties: ['read', 'notify'],
        });
        this._updateValueCallback = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('[BLE] client subscribed to HRM');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('[BLE] client unsubscribed from HRM');
        this._updateValueCallback = null;
    }

    notify(event) {
        const buffer = Buffer.alloc(3);
        // flags
        // 00000001 - 1   - 0x01 - Heart Rate Value Format (0 = uint8, 1 = uint16)
        // 00000010 - 2   - 0x02 - Sensor Contact detected
        // 00000100 - 4   - 0x04 - Sensor Contact Supported
        // 00001000 - 8   - 0x08 - Energy Expended present
        // 00010000 - 16  - 0x10 - RR-Interval present
        buffer.writeUInt8(0x01);
        if ('hr' in event) {
            buffer.writeUInt16LE(Math.min(0xffff, Math.round(event.hr)), 1);
        }
        if (this._updateValueCallback) {
            this._updateValueCallback(buffer);
        }
    }
}

module.exports = HeartRateMeasurementCharacteristic;
