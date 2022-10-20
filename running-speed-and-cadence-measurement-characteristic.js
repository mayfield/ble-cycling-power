var util = require('util');

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

var RSCMeasurementCharacteristic = function() {
  RSCMeasurementCharacteristic.super_.call(this, {
    uuid: '2A53',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: Buffer.from([1, 0])  // notifications enabled
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: Buffer.from([0, 0])  // broadcasts disabled
      })
    ]
  });
  this._updateValueCallback = null;
};

util.inherits(RSCMeasurementCharacteristic, Characteristic);

RSCMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to RSC');
  this._updateValueCallback = updateValueCallback;
  if (this.lastBuffer) {
    console.warn("Sending last good buffer to newly subscribed client");
    const buffer = this.lastBuffer;
    this.lastBuffer = null;
    updateValueCallback(buffer);
  }
};

RSCMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from RSC');
  this._updateValueCallback = null;
};

RSCMeasurementCharacteristic.prototype.notify = function(event) {
  const buffer = Buffer.alloc(4);
  // flags
  // 00000001 - 1   - 0x01 - Instantaneous Stride Length Present
  // 00000010 - 2   - 0x02 - Total Distance Present
  // 00000100 - 4   - 0x04 - Walking or Running Status
  buffer.writeUInt8(0x00);
  if ('speed' in event) {
    // kmh -> ((meters per second) * 256)
    buffer.writeUInt16LE(Math.round(event.speed * 1000 / 3600 * 256), 1);
  }
  if ('cadence' in event) {
    // spm
    buffer.writeUInt8(Math.round(event.cadence) & 0xff, 3);
  }
  if (this._updateValueCallback) {
    this.lastBuffer = null;
    this._updateValueCallback(buffer);
  } else {
    this.lastBuffer = buffer;
  }
};


module.exports = RSCMeasurementCharacteristic;
