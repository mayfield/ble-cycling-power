const bleno = require('./bleno');


class SerialNumberCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2a25',
            properties: ['read'],
            value: Buffer.from('867-5309'),
            descriptors: [new bleno.Descriptor({uuid: '2901', value: '867-5309'})]
        });
    }
}


class ManufacturerCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: '2a29',
            properties: ['read'],
            value: Buffer.from('Sauce for BLE'),
            descriptors: [new bleno.Descriptor({uuid: '2901', value: 'foobar'})]
        });
    }
}


class DeviceInformationService extends bleno.PrimaryService {
    constructor() {
        super({
            uuid: '180a',
            characteristics: [
                new SerialNumberCharacteristic(),
                new ManufacturerCharacteristic(),
            ],
        });
    }
}

module.exports = DeviceInformationService;
