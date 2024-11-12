const bleno = require('./bleno');

// Profile:
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.sensor_location.xml
// 13 = rear hub
// 15 = spider


class CyclingSensorLocationCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2A5D',
            properties: ['read'],
            value: Buffer.from([/*spider*/ 15])
        });
    }
}

module.exports = CyclingSensorLocationCharacteristic;
