const CyclingPowerService = require('./cycling-power-service');
const bleno = require('bleno');
const debug = require('debug')('ble');


const BluetoothPeripheral = function(name) {
  process.env['BLENO_DEVICE_NAME'] = name;
  this.service = new CyclingPowerService();
  this.rev_count = 0;

  this.start = function() {
    bleno.startAdvertising(process.env['BLENO_DEVICE_NAME'],
                           [this.service.uuid]);
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
    debug('advertisingStart: ' + (error ? 'error ' + error : 'success'));
    console.error("START START!!!!!");

    if (!error) {
      bleno.setServices([this.service], function(error){
        debug('setServices: '  + (error ? 'error ' + error : 'success'));
      });
    } else {
      console.error("Doh!", error);
    }
  });
};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
