// this function allows the use of the chrome tracer from apps script
// implements a subset of https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/edit#heading=h.yr4qxyxotyw
'use strict';
var ENUMS = {
  PH: {
    
    DURATION: {
      BEGIN: 'B',
      END: 'E'
    },
    
    COMPLETE: 'X',
    INSTANT: 'i',
    COUNTER: 'C',
    
    ASYNC: {
      NESTABLESTTART:'b',
      NESTABLEINSTANT:'n',
      NESTABLEEND:'e'
    },
    
    FLOW: {
      BEGIN: 's',
      STEP: 't',
      END: 'f'
    },
    
    SAMPLE:'P',
    
    OBJECT: {
      CREATED:'N',
      SNAPSHOT:'O',
      DESTROYED:'D'
    },
    
    METADATA: 'M',
    
    MEMORYDUMP: {
      GLOBAL:'V',
      PROCESS:'v'
    }
  }
};

/**
* a trace manager
* @return {ChromeTrace} self
*/
function ChromeTrace() {
  
  var self = this;
  var items_ = {};
  var accessToken_;  
  var index_ = 0;
  
  /**
   * set the accesstoken that has drive api scope
   * @param {string} accessToken the access token
   * @return {ChromeTrace} self
   */
  self.setAccessToken = function (accessToken) {
    accessToken_ = accessToken;
    return self;
  };
  
  /**
   * get all the items 
   * @return {ChromeTrace.items[]} array of trace items that have been detected
   */
  self.getItems = function () {
    return Object.keys(items_).map( function(d) {
      return items_[d];
    });
  };
  
  /**
   * get all the events for an item
   * @return {ChromeTraceEvent.event[]} array of events associated with this item
   */
  self.getEvents = function (item) {
    return item.map(function(e) {
      return e.getEvent();
    });
  };
  
  /**
   * record a begin event
   * @param {string} name the item name
   * @param {ChromeTraceEvent} options template
   * @return {ChromeTraceEvent} the updated event
   */
  self.begin = function (name, options) {
    return self.eventAdd (name, options , ENUMS.PH.DURATION.BEGIN);
  };
  
  /**
   * record an end event
   * @param {string} name the item name
   * @param {ChromeTraceEvent} options template
   * @return {ChromeTraceEvent} the updated event
   */
  self.end = function (name, options) {
    return self.eventAdd (name, options , ENUMS.PH.DURATION.END);
  };
  
  /**
   * record a counter event
   * @param {string} name the item name
   * @param {ChromeTraceEvent} options template -- args object should contain what's bein gcounted
   * @return {ChromeTraceEvent} the updated event
   */
  self.counter = function (name , options ) {
    return self.eventAdd (name, options , ENUMS.PH.COUNTER);
  };
  
  /**
   * add an event
   * @param {string} name the item name
   * @param {ChromeTraceEvent} options template
   * @param {ChromeTrace.ENUMS.PH} ph the type of event
   * @return {ChromeTraceEvent} the updated event
   */
  self.eventAdd = function (name , options , ph) {
      
     // only string prop names - may clean this up further
     newOptions = makeOptions (name , options);
     newOptions.ph = ph;
     
     // if it's a new name then we add it as a duration item
     if (!items_.hasOwnProperty (newOptions.name) ) {
         items_[newOptions.name] = [];
     }
     
     // push this end event
     items_[newOptions.name].push(new ChromeTraceEvent (newOptions,index_++));
   };
   
   self.dump = function (drivePath , fileName ,name ) {
   
     var item;
     var name = cleanPropertyName(name);
     
     // it's possible to only dump one event stream
     if (name) {
       item = [items_[name]];
       if ( !item) {
         throw 'could not find item ' + name;
       }
     }
     // everything
     else {
       item = self.getItems(items_);
     }
     // get a handler
     var dapi = new cDriveJsonApi.DriveJsonApi().setAccessToken(accessToken_);
     
     // create the path if it doesnt exist
     var folder = dapi.getFolderFromPath (drivePath,true);
     if (!folder) {
      throw 'unable to create/find ' + drivePath; 
     }
   
     // write the data
     if (item) {
       var file = dapi.getFilesByNameOrCreate (folder.id, fileName || ((name || "chrometrace") + ".json") , "application/json" );
       if(!file.success) {
         throw 'failed to create file ' + JSON.stringify(file);
       }
       
       var result = dapi.putContentById  (file.data.items[0].id, JSON.stringify( item.reduce(function(p,c) {
           return cUseful.arrayAppend(p,c);
         },[])
         
         // timestamp order
         .sort(function(a,b){
           return a.getEvent().ts - b.getEvent().ts ? a.ts - b.ts : a.index - b.index;
         })
         
         //strip out to just stringifiable
         .map (function (d) {
           return d.getEvent();
         })
         
       ));

       if(!result.success) {
         throw 'failed to write to file ' + JSON.stringify(result);
       }
     } 
   
   };
   
   function cleanPropertyName (name) {
     return name ? name.toString() : name;
   }
   
   function makeOptions (name, options) {
     opt = cUseful.clone(options || {});
     opt.name = cleanPropertyName(name || opt.name);
     return opt;
   }
   

}

/**
* a chrome event
* @param {ChromeTraceEvent} options template
* @return {ChromeTraceEvent} the updated event
*/
function ChromeTraceEvent(options,index) {

  var self = this;
  self.index = index;
  
  // apply defaults
  var event_ = cUseful.extend ( cUseful.clone(options || {}) , {
    "name": "traceEvent",
    "cat": "",
    "ph": ENUMS.PH.DURATION.BEGIN,
    "ts": new Date().getTime(),
    "pid": 1,
    "tid": 1,
    "args": null
  });
  
  event_.cat = event_.cat || (event_.ph === ENUMS.PH.COUNTER ? 'counter' : 'duration' ); 
  /**
   * return the data for this object
   * @return {ChromeTraceEvent.item}
   */
  self.getEvent = function () {
    return event_;
  };


  return self;
    
}
