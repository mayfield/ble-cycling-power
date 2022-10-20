const CyclingPowerService = require('./cycling-power-service');
const HeartRateService = require('./heart-rate-service');
const RunningSpeedAndCadenceService = require('./running-speed-and-cadence-service');
const bleno = require('bleno');


const BluetoothPeripheral = function(name) {
  process.env['BLENO_DEVICE_NAME'] = name;
  this.powerService = new CyclingPowerService();
  this.hrService = new HeartRateService();
  this.runningService = new RunningSpeedAndCadenceService();
  this.rev_count = 0;

  this.start = function() {
    bleno.startAdvertising(process.env['BLENO_DEVICE_NAME'], [
        this.powerService.uuid,
        this.hrService.uuid,
        this.runningService.uuid,
    ]);
  };
  this.stop = function() {
    bleno.stopAdvertising();
  };

  bleno.on('stateChange', state => {
    console.log('BLE state change: ' + state);

    if (state === 'poweredOn') {
      this.start();
    } else {
      this.stop();
    }
  });

  bleno.on('advertisingStart', error => {
    console.info('BLE advertising start:', {error});
    if (!error) {
      bleno.setServices([this.powerService, this.hrService, this.runningService], function(error) {
        console.info('setServices:', {error});
      });
    } else {
      console.error("Doh!", error);
    }
  });
};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
