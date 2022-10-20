const util = require('util');
const bleno = require('bleno');

const BlenoPrimaryService = bleno.PrimaryService;

const HeartRateMeasurementCharacteristic = require('./heart-rate-measurement-characteristic');


function HeartRateService() {
  this.hrm = new HeartRateMeasurementCharacteristic();
  HeartRateService.super_.call(this, {
      uuid: '180D',
      characteristics: [this.hrm]
  });
  this.notify = function(event) {
    this.hrm.notify(event);
  };
}

util.inherits(HeartRateService, BlenoPrimaryService);

module.exports = HeartRateService;
