// Homebridge plugin to reading Woodstove Sensor on a Raspberry PI.


var Service, Characteristic;
var exec = require('child_process').execFile;
var woodstoveExec;

var debug = require('debug')('Woodstove');
const moment = require('moment');
var os = require("os");
var hostname = os.hostname();

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-woodstove", "Woodstove", WoodstoveAccessory);
}


function WoodstoveAccessory(log, config) {
  this.log = log;
  this.log("Adding Accessory");
  this.config = config;
  this.name = config.name;
  this.name_temperature = config.name_temperature || config.name;
  this.service = config.service || "homebridge-woodstove";
  this.refresh = config.refresh || "60"; // Every minute

  woodstoveExec = config.woodstoveExec || "python";

  this.log_event_counter = 59;
}

WoodstoveAccessory.prototype = {

  getWoodstoveTemperature: function(callback) {

    exec(woodstoveExec, ["/home/pi/Downloads/homebridge-woodstove/MAX31855-HB.py"], function(error, responseBody, stderr) {
    // exec(woodstoveExec, function(error, responseBody, stderr) {
      if (error !== null) {
        this.log('woodstoveExec function failed: ' + error);
        callback(error);
      } else {
        var result = responseBody.toString();
        var temperature = parseFloat(result);
        var temperatureF = temperature*9/5+32;
        //                this.humidity = humidity;
        this.log("Temperature: %s", temperatureF);


        this.log_event_counter = this.log_event_counter + 1;
        if (this.log_event_counter > 59) {
          this.log_event_counter = 0;
        }
        var err;
        callback(err, temperature);
      }
    }.bind(this));
  },


  identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getServices: function() {

    this.log("INIT: %s", this.name);

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "2xj")
      .setCharacteristic(Characteristic.Model, this.service)
      .setCharacteristic(Characteristic.SerialNumber, hostname+"-"+this.name)
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version);

    switch (this.service) {

      case "homebridge-woodstove":
        this.woodstoveService = new Service.TemperatureSensor(this.name_temperature);
        this.woodstoveService
          .getCharacteristic(Characteristic.CurrentTemperature)
          .setProps({
            minValue: -100,
            maxValue: 1500
          });


        this.woodstoveService.log = this.log;

        setInterval(function() {
          this.getWoodstoveTemperature(function(err, temp) {
            if (err)
              temp = err;
            this.woodstoveService
              .getCharacteristic(Characteristic.CurrentTemperature).updateValue(temp);
          }.bind(this));

        }.bind(this), this.refresh * 1000);

        this.getWoodstoveTemperature(function(err, temp) {
          this.woodstoveService
            .setCharacteristic(Characteristic.CurrentTemperature, temp);
        }.bind(this));
        return [this.woodstoveService, informationService];

    }
  }
};
