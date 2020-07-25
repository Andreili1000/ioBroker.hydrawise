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
// define global variables here
//

//
// local copy of state variables (array)
//
var currentStateValues = {};  // always keep the last value of the state variables

//
// Prowl Interface Definition
//
var prowl_url    = "http://prowl.weks.net/publicapi/add?apikey=";

//
// Hydrawise REST API definitions
//
var hydrawise_url_command    = "https://app.hydrawise.com/api/v1/setzone.php?";
var hydrawise_url_status     = "https://app.hydrawise.com/api/v1/statusschedule.php?";

//
// hc6 controller state definition
//

var hc6          = {message: "", 
                    nextpoll: 0, 
                    time: 0, 
                    relays:  [{name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0},
                              {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0},
                              {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0},
                              {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0},
                              {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0},
                              {name:"", period:0, relay:0, relay_id:0, run:0, time:0, timestr:"", type:0}
                             ], 
                    sensors: [{input:0, mode:0, offtimer:0, timer:0, type:0, relays:[0,0,0,0,0,0]},
                              {input:0, mode:0, offtimer:0, timer:0, type:0, relays:[0,0,0,0,0,0]}   
                             ]
                  };

//
// constants
//
const run_min = 120;    // minimum runtime = 2 Minutes
const run_max = 5400;   // maximum runtime = 1h30 min

var runtime = run_min;  // runtime which is used in REST API command

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

      this.log.debug(prowl_url + this.config.prowl_apikey + "&application=" + this.namespace
        + "&priority=" + priority + "&description="+message);

      request(prowl_url + this.config.prowl_apikey + "&application=" + this.namespace
        + "&priority=" + priority + "&description="+message);
    }

    readHydrawiseStatus(){
      const cmd = hydrawise_url_status + "api_key=" + this.config.hydrawise_apikey;

      this.log.info("send: "+cmd);
      //request(cmd, function (error, response, body){
      request(cmd, (error, response, body) => {

        if (!error && response.statusCode == 200) {
          // parse JSON response from Hydrawise controller
          var obj = JSON.parse(body);
          // read device config
          hc6.nextpoll = parseInt(obj.nextpoll);
          hc6.time     = parseInt(obj.time);
          hc6.message  = obj.message;
          this.log.info("nextpoll="+hc6.nextpoll+" time="+hc6.time+" message="+hc6.message);
 
          // read all configured sensors
          for (let i=0; i<=1; i++){
            // if sensor is configured
            if (obj.sensors[i]!=null){
              hc6.sensors[i].input = parseInt(obj.sensors[i].input);
              hc6.sensors[i].type = parseInt(obj.sensors[i].type);
              hc6.sensors[i].mode = parseInt(obj.sensors[i].mode);
              hc6.sensors[i].timer = parseInt(obj.sensors[i].timer);
              hc6.sensors[i].offtimer = parseInt(obj.sensors[i].offtimer);
              // read all related relays
              for (let j=0; j<=5; j++){
                // if relay is configured
                if (obj.sensors[i].relays[j]!=null){
                  hc6.sensors[i].relays[j]=obj.sensors[i].relays[j].id
                }
              };
            }
            this.log.info("sensor"+i+": input="+hc6.sensors[i].input+" type="+hc6.sensors[i].type+
            " mode="+hc6.sensors[i].mode+ " timer="+hc6.sensors[i].timer+" offtimer="+hc6.sensors[i].offtimer+
            " relay0="+hc6.sensors[i].relays[0]+" relay1="+hc6.sensors[i].relays[1]+" relay2="+hc6.sensors[i].relays[2]+
            " relay3="+hc6.sensors[i].relays[3]+" relay4="+hc6.sensors[i].relays[4]+" relay5="+hc6.sensors[i].relays[5]);
          }

          // read all configured relays
          for (let i=0; i<=5; i++){
            if (obj.relays[i]!=null){
              hc6.relays[i].relay_id  = parseInt(obj.relays[i].relay_id);
              hc6.relays[i].name      = obj.relays[i].name;
              hc6.relays[i].relay     = parseInt(obj.relays[i].relay);
              hc6.relays[i].type      = parseInt(obj.relays[i].type);
              hc6.relays[i].time      = parseInt(obj.relays[i].time);
              hc6.relays[i].run       = parseInt(obj.relays[i].run);
              hc6.relays[i].period    = parseInt(obj.relays[i].period);
              hc6.relays[i].timestr   = obj.relays[i].timestr;
            }
            else{
              hc6.relays[i].relay_id  = 0;
              hc6.relays[i].name      = "";
              hc6.relays[i].relay     = 0;
              hc6.relays[i].type      = 0;
              hc6.relays[i].time      = 0;
              hc6.relays[i].run       = 0;
              hc6.relays[i].period    = 0;
              hc6.relays[i].timestr   = "";
            }
            this.log.info("relay"+i+": relay_id="+hc6.relays[i].relay_id+" name="+hc6.relays[i].name+
            " relay="+hc6.relays[i].relay+" type="+hc6.relays[i].type+" time="+hc6.relays[i].time+
            " run="+hc6.relays[i].run+" period="+hc6.relays[i].period+" timestr="+hc6.relays[i].timestr);
          }
        }
      });
    }

    //
    // retrieves relay_id of Zone 1..6, returns 0 if out of range
    //
    relayid(zone){
      if (zone<1 || zone>6) {this.log.info("invalid zone number: "+zone);return 0};
      return hc6.relays[zone-1].relay_id;
    }

    //
    // retrieves name of Zone 1..6, returns "unknown" if relay_id = 0 (out of range / not defined)
    //
    zonename(zone){
      let relay_id = this.relayid(zone);
      if (relay_id == 0) return "unknown";
      for (let i=0; i<=5; i++){
        if (hc6.relays[i].relay_id==relay_id){return hc6.relays[i].name}
      };
      return "unknown"
    }

    //
    // limits runtime to defined run_min resp. run_max values
    //
    runtime_limit(runtime){
      if (runtime<run_min) {this.log.info("runtime limited to "+run_min+" s");return run_min};
      if (runtime>run_max) {this.log.info("runtime limited to "+run_max+" s");return run_max};
      return runtime;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        
        // initialize internal copy of state variables
        this.setStateInternal('custom_run', 120);
        this.setStateInternal('custom_suspend', 0);
        this.setStateInternal('zone', 1);

        // initialize hc information from controller when api key has been set via config page
        if (this.config.hydrawise_apikey!=undefined){this.readHydrawiseStatus()};

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
                  // run zone <zone> for <custom_run> seconds
                  //
                  case "run":
                    request(hydrawise_url_command + "action=run&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')) + "&custom="
                            + runtime);
                    this.log.info(hydrawise_url_command + "action=run&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')) + "&custom="
                            + runtime);
                    this.sentProwlMessage(0, "Run zone "+this.zonename(this.getStateInternal('zone'))+" for "+runtime+" s");        
                    break;
                  //
                  // run all zones for <custom_run> seconds
                  //       
                  case "runall":
                    request(hydrawise_url_command + "action=runall&api_key=" + this.config.hydrawise_apikey + "&period_id=999&custom="+ runtime);
                    this.log.info(hydrawise_url_command + "action=runall&api_key=" + this.config.hydrawise_apikey + "&period_id=999&&custom="+ runtime);
                    this.sentProwlMessage(0, "Run all zones for "+runtime+" s");      
                    break;
                  //
                  // stop zone <zone>
                  //
                  case "stop":
                    request(hydrawise_url_command + "action=stop&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')));
                    this.log.info(hydrawise_url_command + "action=stop&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')));
                    this.sentProwlMessage(0, "Stop zone "+this.zonename(this.getStateInternal('zone')));   
                    break;
                  //
                  // stop all zones
                  //  
                  case "stopall":
                    request(hydrawise_url_command + "action=stopall&api_key=" + this.config.hydrawise_apikey);
                    this.log.info(hydrawise_url_command + "action=stopall&api_key=" + this.config.hydrawise_apikey);
                    this.sentProwlMessage(0, "Stop all zones");   
                    break;
                  //
                  // suspend zone <zone> until <custom_suspend>
                  //  
                  case "suspend":
                    request(hydrawise_url_command + "action=suspend&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')) + "&custom="
                            + this.getStateInternal('custom_suspend'));
                    this.log.info(hydrawise_url_command + "action=suspend&api_key=" + this.config.hydrawise_apikey
                            + "&period_id=999&relay_id=" + this.relayid(this.getStateInternal('zone')) + "&custom="
                            + this.getStateInternal('custom_suspend'));
                    this.sentProwlMessage(0, "Suspend zone "+this.zonename(this.getStateInternal('zone'))+" for "+this.getStateInternal('custom_suspend')+" s");   
                    break;
                  //     
                  // suspend all zones until <custom_suspend>
                  //
                  case "suspendall":
                      request(hydrawise_url_command + "action=suspendall&api_key=" + this.config.hydrawise_apikey 
                              + "&period_id=999&custom="+ this.getStateInternal('custom_suspend'));
                      this.log.info(hydrawise_url_command + "action=suspendall&api_key=" + this.config.hydrawise_apikey
                             + "&period_id=999&custom="+ this.getStateInternal('custom_suspend'));
                      this.sentProwlMessage(0, "Suspend all zones for "+this.getStateInternal('custom_suspend')+" s");   
                    break;
                  //
                  // read controller configuration
                  //
                  case "readstatus":
                    this.readHydrawiseStatus();
                    this.log.info("read status of HC6 controller");
                    break;
                  //
                  // command not implemented
                  //
                  default:
                    this.log.info("Command \""+state.val+"\" is unknown");
                    break;  
                }
                break;
              // limit runtime to run_min resp. run_max
              case this.namespace + '.custom_run':
                runtime = this.runtime_limit(this.getStateInternal('custom_run'));
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
