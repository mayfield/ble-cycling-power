const util = require('util');
const bleno = require('bleno');

const CyclingPowerMeasurementCharacteristic = require('./cycling-power-measurement-characteristic');
const CylingPowerFeatureCharacteristic = require('./cycling-power-feature-characteristic');
const CyclingSensorLocationCharacteristic = require('./cycling-sensor-location-characteristic');


function CyclingPowerService() {
    this.pm = new CyclingPowerMeasurementCharacteristic();
    CyclingPowerService.super_.call(this, {
        uuid: '1818',
        characteristics: [
            this.pm,
            new CylingPowerFeatureCharacteristic(),
            new CyclingSensorLocationCharacteristic(),
      ]
  });
  this.notify = function(event) {
    this.pm.notify(event);
  };
}

util.inherits(CyclingPowerService, bleno.PrimaryService);

module.exports = {CyclingPowerService};
