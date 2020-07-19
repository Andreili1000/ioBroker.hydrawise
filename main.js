// @ts-nocheck
'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here
var request = require('request');

//
// local copy of state variables (array)
//
let currentStateValues = {};  // always keep the last value of the state variables


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

        //
        // declare all additional properties of class
        //

        //
        // Hydrawise REST API definitions
        //
        this.hydrawise_url_command    = "https://app.hydrawise.com/api/v1/setzone.php?";
        this.hydrawise_url_status     = "https://app.hydrawise.com/api/v1/statusschedule.php?";

        //
        // HC6 controller state definition
        //
        this.relay        = {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0};
        this.sensor       = {input:0, mode:0, offtimer:0, timer:0, type:0, relays:[0,0,0,0,0,0]};
        this.hc6          = {message: "",
                             nextpoll: 0,
                             time: 0,
                             relays: [this.relay,this.relay,this.relay,this.relay,this.relay,this.relay],
                             sensors: [this.sensor,this.sensor]
                            };

        //
        // Prowl Interface Definition
        //
        this.prowl_url    = "http://prowl.weks.net/publicapi/add?apikey=";
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

      this.log.debug(this.prowl_url + this.config.prowl_apikey + "&application=" + this.namespace
        + "&priority=" + priority + "&description="+message);

      request(this.prowl_url + this.config.prowl_apikey + "&application=" + this.namespace
        + "&priority=" + priority + "&description="+message);
    }

    readHydrawiseStatus(){
      const cmd = this.hydrawise_url_status + "api_key=" + this.config.hydrawise_apikey;

      this.log.info("send: "+cmd);
      //request(cmd, function(error, response, body){
      request(cmd, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          // parse JSON response from Hydrawise controller
          var obj = JSON.parse(body);
          // read device config
          this.hc6.nextpoll = parseInt(obj.nextpoll);
          this.hc6.time     = parseInt(obj.time);
          this.hc6.message  = obj.message;
          this.log.info("nextpoll="+this.hc6.nextpoll+" time="+this.hc6.time+" message="+this.hc6.message)
          
          // read all configured sensors
          for (let i=0; i<=1; i++){
            if (obj.sensors[i]!=null){
              this.hc6.sensors[i].input    = parseInt(obj.sensors[i].input);
              this.hc6.sensors[i].type     = parseInt(obj.sensors[i].type);
              this.hc6.sensors[i].mode     = parseInt(obj.sensors[i].mode);
              this.hc6.sensors[i].timer    = parseInt(obj.sensors[i].timer);
              this.hc6.sensors[i].offtimer = parseInt(obj.sensors[i].offtimer);
              for (let j=0; j<=5; j++){
                this.hc6.sensors[i].relays[j]=0;
                if (obj.sensors[i].relays[j]!=null) {this.hc6.sensors[i].relays[j] = parseInt(obj.sensors[i].relays[j].id)};
                this.log.info("sensor"+i+": relay"+j+": id="+this.hc6.sensors[i].relays[j]);
              }
            }
          }
          // read all configured relays
          for (let i=0; i<=5; i++){
            if (obj.relays[i]!=null){
              this.hc6.relays[i].relay_id  = parseInt(obj.relays[i].relay_id);
              this.hc6.relays[i].name      = obj.relays[i].name;
              this.hc6.relays[i].relay     = parseInt(obj.relays[i].relay);
              this.hc6.relays[i].type      = parseInt(obj.relays[i].type);
              this.hc6.relays[i].time      = parseInt(obj.relays[i].time);
              this.hc6.relays[i].run       = parseInt(obj.relays[i].run);
              this.hc6.relays[i].period    = parseInt(obj.relays[i].period);
              this.hc6.relays[i].timestr   = obj.relays[i].timestr;
            }
            else{
              this.hc6.relays[i].relay_id  = 0;
              this.hc6.relays[i].name      = "";
              this.hc6.relays[i].relay     = 0;
              this.hc6.relays[i].type      = 0;
              this.hc6.relays[i].time      = 0;
              this.hc6.relays[i].run       = 0;
              this.hc6.relays[i].period    = 0;
              this.hc6.relays[i].timestr   = "";
            }
            this.log.info("relay"+i+": relay_id="+this.hc6.relays[i].relay_id+" name="+this.hc6.relays[i].name+
            " relay="+this.hc6.relays[i].relay+" type="+this.hc6.relays[i].type+" time="+this.hc6.relays[i].time+
            " run="+this.hc6.relays[i].run+" period="+this.hc6.relays[i].period+" timestr="+this.hc6.relays[i].timestr);
          }
        }
      });
    }


    //
    // retrieves relay_id of Zone 1..6
    //
    relayid(zone){
      let array_id = zone-1;
      this.log.info("zone="+zone+" array_id="+array_id+" relay_id="+this.hc6.relays[0].relay_id);
      return this.hc6.relays[array_id].relay_id;
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

       // initialize hc6 information from controller
       this.readHydrawiseStatus();

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
                  //
                  // run zone <zone> for <run> seconds
                  //
                  case "run":
                    this.log.info("relay0-relay_id="+this.hc6.relays[0].relay_id);

                    this.log.info(this.hydrawise_url_command + "action=run&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')) + ";custom="
                            + this.getStateInternal('custom_run'));

                    //request(this.hydrawise_url_command + "action=run&api_key=" + this.config.hydrawise_apikey
                    //        + "&period_id=999&relay_id=" + this.getStateInternal('zone') + ";custom="
                    //        + this.getStateInternal('custom_run'));
                    break;

                  case "stop":
                    this.log.info("execute stop");
                    this.sentProwlMessage(0, "execute stop");
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
                  case "readstatus":
                    this.log.info("execute readstatus");
                    this.readHydrawiseStatus();
                    break;
                  case "test":
                    this.sentProwlMessage(0, "ProwlTest")
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
