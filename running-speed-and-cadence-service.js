const bleno = require('./bleno');

const BlenoPrimaryService = bleno.PrimaryService;
const {RSCMeasurementCharacteristic, RSCFeatureCharacteristic} =
    require('./running-speed-and-cadence-measurement-characteristic');


class RunningSpeedAndCadenceService extends BlenoPrimaryService {
    constructor() {
        const rscMeasurement = new RSCMeasurementCharacteristic();
        super({
            uuid: '1814',
            characteristics: [rscMeasurement, new RSCFeatureCharacteristic()]
        });
        this.rscMeasurement = rscMeasurement;
    }

    notify(event) {
        this.rscMeasurement.notify(event);
    }
}

module.exports = RunningSpeedAndCadenceService;
