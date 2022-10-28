const util = require('util');
const bleno = require('bleno');

const BlenoPrimaryService = bleno.PrimaryService;

const {RSCMeasurementCharacteristic, RSCFeatureCharacteristic} = require('./running-speed-and-cadence-measurement-characteristic');


function RunningSpeedAndCadenceService() {
    this.rscMeasurement = new RSCMeasurementCharacteristic();
    RunningSpeedAndCadenceService.super_.call(this, {
        uuid: '1814',
        characteristics: [this.rscMeasurement, new RSCFeatureCharacteristic()]
    });
    this.notify = function(event) {
        this.rscMeasurement.notify(event);
    };
}

util.inherits(RunningSpeedAndCadenceService, BlenoPrimaryService);

module.exports = RunningSpeedAndCadenceService;