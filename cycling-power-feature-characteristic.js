const bleno = require('./bleno');

class CyclingPowerFeatureCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A65',
            properties: ['read'],
            // 0x01 - pedal power balance supported
            // 0x02 - accumulated torque supported
            // 0x04 - wheel revolutions supported
            // 0x08 - crank revolutions supported
            value: Buffer.from([0x8, 0, 0, 0]), // crank rev
        });
    }
}

module.exports = CyclingPowerFeatureCharacteristic;
