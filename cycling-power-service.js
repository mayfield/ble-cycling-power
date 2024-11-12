const bleno = require('./bleno');

const CyclingPowerMeasurementCharacteristic = require('./cycling-power-measurement-characteristic');
const CylingPowerFeatureCharacteristic = require('./cycling-power-feature-characteristic');
const CyclingSensorLocationCharacteristic = require('./cycling-sensor-location-characteristic');


class CyclingPowerService extends bleno.PrimaryService {
    constructor() {
        const pm = new CyclingPowerMeasurementCharacteristic();
        super({
            uuid: '1818',
            characteristics: [
                pm,
                new CylingPowerFeatureCharacteristic(),
                new CyclingSensorLocationCharacteristic(),
            ]
        });
        this.pm = pm;
    }

    notify(event) {
        this.pm.notify(event);
    }
}

module.exports = {CyclingPowerService};
