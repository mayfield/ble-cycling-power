const util = require('util');
const bleno = require('@abandonware/bleno');

class SensorLocationCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A38',
            properties: ['read'],
            // 1 = chest
            value: Buffer.alloc([1])
        });
    }
}

module.exports = SensorLocationCharacteristic;
