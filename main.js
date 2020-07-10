'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

//
var request = require('request');


// Load your modules here, e.g.:
// const fs = require("fs");

//
// Hydrawise REST API definitions
//
let hydrawise_api  = "";
let url_status     = "https://app.hydrawise.com/api/v1/statusschedule.php?";
let url_command    = "https://app.hydrawise.com/api/v1/setzone.php?";

//
// local copy of state variables (array)
//
let currentStateValues = {};  // always keep the last value of the state variables

//
// HC6 controller state definition
//
let relay    = {name:"", period:0, relay:0, id:0, run:0, time:0, timestr:"", type:0};
let sensor   = {input:0, mode:0, offtimer:0, relay1:0, relay2:0, relay3:0, relay4:0, relay5:0, relay6:0, timer:0, type:0};
let relays   = {relay,relay,relay,relay,relay,relay};  // Zone information of Zone 1-6
let sensors  = {sensor, sensor};                       // Sensor information of Sensors 1-2
let message  = "";                                     // Status message for account
let nextpoll = 0;                                      // Indication of number of seconds until you should make your next request to this endpoint
let time     = 0;                                      // UNIX epoche

//
// Prowl API definitions
//
const prowl_application = this.namespace;
const prowl_url         = "http://prowl.weks.net/publicapi/add?apikey="

//
// Hydrawise Adapter functions
//

function clear_status() {
  relays  = {relay,relay,relay,relay,relay,relay};  // Zone information of Zone 1-6
  sensors = {sensor,sensor};                        // Sensor information of Sensors 1-2
  message = "";
  nextpoll = 0;
  time = 0;
}


class Hydrawise extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'hydrawise',
        });
        // maps adapter states to functions onReady, onStateChange, onObjectChange onMessage, onUnload
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    //
    // reads value out of local copy of state variable "id"
    //
    getStateInternal(id) {
     var obj = id;
     if (! obj.startsWith(this.namespace + '.'))
       obj = this.namespace + '.' + id;
     return currentStateValues[obj];
    }

    //
    // updates local copy of state variable "id" with value "value"
    //
    setStateInternal(id, value) {
     var obj = id;
     if (! obj.startsWith(this.namespace + '.'))
       obj = this.namespace + '.' + id;
     this.log.info('update state ' + obj + ' with value:' + value);
     currentStateValues[obj] = value;
    }

    //
    // sents push message via prowl
    //
    sentProwlMessage(priority, message) {
        this.log.debug(prowl_url + this.config.prowl_apikey + "&application=" + prowl_application
        + "&priority=" + priority + "&description="+message);

        request(prowl_url + this.config.prowl_apikey + "&application=" + prowl_application
        + "&priority=" + priority + "&description="+message);
    }




    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //hydrawise_api = this.config.hydrawise_apikey;
        //this.log.info('Hydrawise API key: ' + hydrawise_api);
        //prowl_api = this.config.prowl_apikey;
        //this.log.info('Prowl API key: ' + prowl_api);


       // initialize internal copy of state variables
       this.setStateInternal('custom_run', 0);
       this.setStateInternal('custom_suspend', 0);
       this.setStateInternal('zone',0),

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */

        /* await this.setObjectNotExistsAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });
        */

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)

        // -- await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system

        // -- await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)

        // -- await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        // let result = await this.checkPasswordAsync('admin', 'iobroker');
        // this.log.info('check user admin pw iobroker: ' + result);
        // result = await this.checkGroupAsync('admin', 'admin');
        // this.log.info('check group user admin group admin: ' + result);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {

    // Warning: state can be null if it was deleted!
        if (state) {

            // The state was changed
            // update local copy of that state variable
            this.setStateInternal(id, state.val);

            // execute individual commands based on the actual state change
            switch (id){
              // execute Hydrawise command if changed
              case this.namespace + '.command':
                switch (state.val){
                  case "run":
                    this.log.info("execute run");
                    this.sentProwlMessage(0, "execute run")
                    break;
                  case "stop":
                    this.log.info("execute stop");
                    break;
                  case "suspend":
                    this.log.info("execute suspend");
                    break;
                  case "runall":
                    this.log.info("execute runall");
                    break;
                  case "stopall":
                    this.log.info("execute stopall");
                    break;
                  case "suspendall":
                    this.log.info("execute suspendall");
                    break;
                }
              break;
            }

        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Hydrawise(options);
} else {
    // otherwise start the instance directly
    new Hydrawise();
}
