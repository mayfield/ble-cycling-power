const util = require('util');
const bleno = require('bleno');

const HeartRateMeasurementCharacteristic = require('./heart-rate-measurement-characteristic');


function HeartRateService() {
    this.hrm = new HeartRateMeasurementCharacteristic();
    HeartRateService.super_.call(this, {
        uuid: '180d',
        characteristics: [this.hrm],
    });
    this.notify = function(event) {
        this.hrm.notify(event);
    };
}
util.inherits(HeartRateService, bleno.PrimaryService);

module.exports = HeartRateService;
