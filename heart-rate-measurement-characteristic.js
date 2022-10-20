var util = require('util');

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

var HeartRateMeasurementCharacteristic = function() {
  HeartRateMeasurementCharacteristic.super_.call(this, {
    uuid: '2A37',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: new Buffer([1, 0])  // notifications enabled
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: new Buffer([0, 0])  // broadcasts disabled
      })
    ]
  });
  this._updateValueCallback = null;
};

util.inherits(HeartRateMeasurementCharacteristic, Characteristic);

HeartRateMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to HRM');
  this._updateValueCallback = updateValueCallback;
  if (this.lastBuffer) {
    console.warn("Sending last good buffer to newly subscribed client");
    const buffer = this.lastBuffer;
    this.lastBuffer = null;
    updateValueCallback(buffer);
  }
};

HeartRateMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from HRM');
  this._updateValueCallback = null;
};

HeartRateMeasurementCharacteristic.prototype.notify = function(event) {
  const buffer = Buffer.alloc(2);
  // flags
  // 00000001 - 1   - 0x01 - Heart Rate Value Format (0 = uint8, 1 = uint16)
  // 00000010 - 2   - 0x02 - Sensor Contact detected
  // 00000100 - 4   - 0x04 - Sensor Contact Supported
  // 00001000 - 8   - 0x08 - Energy Expended present
  // 00010000 - 16  - 0x10 - RR-Interval present
  buffer.writeUInt8(0x01 | 0x02);
  if ('hr' in event) {
    buffer.writeUInt8(Math.round(event.hr), 1);
  }
  if (this._updateValueCallback) {
    this.lastBuffer = null;
    this._updateValueCallback(buffer);
  } else {
    this.lastBuffer = buffer;
  }
}


module.exports = HeartRateMeasurementCharacteristic;
