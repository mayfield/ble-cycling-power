const bleno = require('@abandonware/bleno');

const HeartRateMeasurementCharacteristic = require('./heart-rate-measurement-characteristic');


class HeartRateService extends bleno.PrimaryService {
    constructor() {
        const hrm = new HeartRateMeasurementCharacteristic();
        super({
            uuid: '180d',
            characteristics: [hrm],
        });
        this.hrm = hrm;
    }

    notify(event) {
        this.hrm.notify(event);
    }
}

module.exports = HeartRateService;
