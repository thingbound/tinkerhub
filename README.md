# Tinkerhub

Tinkerhub is a library for building, connecting, interacting and tinkering with
things on your local network. It can be used for home automation, such as
turning appliances on and off, monitoring sensor data and other IoT workloads.

The base of Tinkerhub is a network in which a library can choose to expose
things and appliances, such as lights, sensors and services. Any NodeJS
instance connected to the network can then see and interact with these things.

To setup a network the easiest way is to install
[tinkerhub-daemon](https://github.com/tinkerhub/tinkerhub-daemon) to host plugins
and to use [tinkerhub-cli](https://github.com/tinkerhub/tinkerhub-cli) to
interact with them.

## Getting started and joining the local network

Tinkerhub requires at least Node 8.

To get started install the `tinkerhub` library:

```
npm install tinkerhub
```

Tinkerhub will automatically connect to other instances on the same local
network and make their devices available to the local instance. This is done
automatically on `require('tinkerhub')`.

```javascript
// Asynchronously connect to instances on the local network
const th = require('tinkerhub');
```

## Discovering things

Things can join or leave the network at any time. It's possible to listen
to `thing:available` and `thing:unavailable` to be notified when this happens.

```javascript
th.on('thing:available', thing => {
  console.log('New thing', thing);
});
```

The library provides access to everything it can reach via collections. A
collection is a filtered view of things on the current network.

```javascript
// Get everything
const allDevices = th.all();

// Filter things based on types, capabilities and tags
const lights = th.get('type:light');
```

Collections also support the `thing:available` and `thing:unavailable` events.

```javascript
const switchableLights = th.get('type:light', 'cap:switchable');

switchableLights.on('thing:available', light => console.log('Found a light', light));

switchableLights.destroy(); // Destroy the collection and remove all listeners
```

The event `thing:updated` can be used to listen for updates, such as changes
in name, tags, type or capabilities:

```javascript
switchableLights.on('thing:updated', light => console.log('Light has changed', light));
```

## Interacting with things

All things have metadata associated with them, which contains information about
their unique identifier, name (if any), types and capabilities.

```javascript
console.log(thing.metadata.id); // "idOfDevice"
console.log(thing.metadata.name); // "Human-readable name if any"
console.log(thing.metadata.types); // Set [ 'light', 'otherType' ]
console.log(thing.metadata.capabilities); // Set [ 'dimmable', 'colors' ]
console.log(thing.metadata.tags); // Set [ 'livingroom', 'type:light', 'cap:dimmable' ]
```

Types and capabilities are used to indicate what a thing is and what it is
capable of doing. Most things you will encounter use a standarized API that
is defined in the project called [abstract-things](https://github.com/tinkerhub/abstract-things).

### Performing actions

All things support actions, which can be invoked as normal JavaScript functions.
Actions in Tinkerhub always return a promise that will resolve to the
result of the invocation.

```javascript
 // Turn on the thing on asynchronously
thing.turnOn()
  .then(power => console.log('Power is now', power));

// Collections work the same but return a multi result
th.get('type:light')
  .power()
  .then(result => console.log('Power is mostly', result.mostlyTrue()));
```

### Listening for events

Most things also emit events whenever things change. These can be listened
to via `on`:

```javascript
// Start listening
const handle = thing.on('power', (power, thing) => {
  // Device has either been turned on or off
  console.log('Power of', thing, 'is now', power);
});

// To stop listening
handle.stop();
```

The same is true for collections, where an event will be trigged if any
thing in the collection emits an event:

```javascript
const collection = th.get('type:light')
  .on('power', (power, thing) => {
    setTimeout(() => thing.turnOff(), 30000);
  });
```

Note: Collections do not return a event handles, the easiest way to stop
listening for events on a collection is to call `destroy()` on it.

### Waiting for things

Tinkerhub connects asynchronously and things can be found at any time so
scripting can be difficult if you just want to perform an action or two.
Something like this will fail if run via `node script.js`:

```javascript
const th = require('tinkerhub');

th.get('type:light').turnOff(); // Don't do this, the collection will be empty
```

A special function named `awaitThings` is available for collections that will
wait until things are mostly available:

```javascript
const th = require('tinkerhub');

th.get('type:light')
  .awaitThings()
  .then(things => things.turnOff())
  .catch(th.errorHandler);
  .then(() => process.exit()) // To exit Node
```

This will wait in chunks of 500 ms for things to be found. After a few seconds
it will resolve even if no things have been found.

## Building a thing

Things in Tinkerhub are based on the library [abstract-things](https://github.com/tinkerhub/abstract-things), it contains both generic and specific types and capabilities for things such as sensors, lights, humidifiers, switches and so on.

A very basic thing may look something like this:

```javascript
const th = require('tinkerhub');
const { Thing } = require('abstract-things');
const { duration } = require('abstract-things/values');

/**
 * Timer that calls itself `timer:global` and that allows timers to be set
 * and listened for in the network.
 */
class Timer extends Thing {
  static get type() {
    return 'timer';
  }

  constructor() {
    super();

    this.id = 'timer:global';
  }

  addTimer(name, delay) {
    if(! name) throw new Error('Timer needs a name');
    if(! delay) throw new Error('Timer needs a delay');

    delay = duration(delay);

    setTimeout(() => {
      this.emitEvent('timer', name);
    }, delay.ms)
  }
}

// Register the timer
th.register(new Timer())
  .then(handle => /* handle.remove() can be used to remove thing */)
  .catch(th.errorHandler);
```

## Organizing Things

Things support user defined tags via their metadata. These tags are persisted
on the same machine as a thing is registered. In the API tags are merged with
system generated tags such as type tags and capability tags.

This can be used to create groups of things, such as all things found in a
certain room. This allows for things such as this:

```javascript
// Fetch lights in the living room and turn them on
th.get('type:light', 'living-room').turnOn();
```

The thing metadata object contains an API that can be used to the user defined
tags of a device. Currently the prefixes `type:` and `cap:` are reserved.

```javascript
console.log(thing.tags); // Get all of the tags

thing.metadata.addTags('tag1', ..., 'tagN'); // Add tags to the thing

thing.metadata.removeTags('tag1', ..., 'tagN'); // Remove tags from the thing
```

The easiest way to tag upp things is to use [tinkerhub-cli](https://github.com/tinkerhub/tinkerhub-cli)
and simply do `deviceIdOrTag metadata tag nameOfTag`.

### Advanced matching

Advanced matching is supported via `th.match` for example to match all lights
that are not tagged with `living-room`:

```javascript
// Get lights not tagged with living-room
th.get('type:light', th.match.not('living-room'))
```

`th.match.or` and `th.match.and` can be used to get things using more advanced
queries:

```javascript
// Get things that are either lights or air purifiers
th.get(th.match.or('type:light', 'type:air-purifier'));

// Get things that are either lights or air purifiers that can switch their power
th.get(th.match.or('type:light', 'type:air-purifier'), 'cap:switchable-power');

// Either lights that can switch their power or things with switchable mode
th.get(th.match.or(
  th.match.and('type:light', 'cap:switchable-power'),
  'cap:switchable-mode'
));
```

## Extending things in the network

Tinkerhub automatically merges things with the same identifier which allows
one instance to be extended with new capabilities by other libaries.

This is primarily used together with plugins that bridge in things, such
as Bluetooth peripherals or Z-wave devices. This allows the bridge to provide
a generic API and other libraries to extend these things and make them in to
specific types.

```javascript
/*
 * Get all Bluetooth Low Energy devices that are connected and extend them
 * if they support a certain type.
 */
th.get('type:bluetooth-low-energy', 'cap:ble-connected')
  .extendWith(thing => thing.bleInspect()
    .then(data => {
      if(! data.services[SOME_SERVICE_ID]) return;

      return new SpecificThing(thing);
    })
  );
});
```

## Handling errors

Most things in Tinkerhub return promises and `catch` should be used to handle
errors from all promises. There are three main ways errors should be handled:

1. Catch the error - but only if you can recover. Catching errors is usually done for non-important errors that can be recovered from by doing things such as retrying requests.


  ```javascript
  function doBackgroundStuff() {
    getPromiseSomehow()
      .then(result => /* handle result as normal */)
      .catch(err => setTimeout(doBackgroundStuff, 1000); // Retry every second until it succeeds (use a better retry strategy)
  }
  ```

2. Ignore the error - but only if you return a promise (or similar). This allows for example another consumer to handle the error in a better way.

  ```javascript
  function doStuff() {
    return getPromiseSomehow()
      .then(result => /* handle and manipulate results */)
  }
  ```

3. Log the error - when the error isn't that important or you can't recover from it. A utility is available that will do this: `th.errorHandler`.

  ```javascript
  function doStuff() {
    return getPromiseSomehow()
      .then(result => /* handle and manipulate results */)
      .catch(th.errorHandler);
  }

  // Or when registering a thing:
  th.register(new Thing())
    .then(handle => /* handle points to the thing so it can be removed */)
    .catch(th.errorHandler);
  ```

### Development helper

When developing a plugin or custom behavior Tinkerhub contains a utility that
will log and output errors from things such as unhandled promise rejections.
To activate it, put something like this in the main file of the project:

```javascript
if(! module.parent) {
  // Only activate development mode if this file was run directly via `node nameOfFile.js`
  th.errorHandler.development();
}
```

This will turn on logging to the console for the namespace `th:error`. Any
uncaught promise rejection or call to `th.errorHandler` will be displayed in
full.

## Debug logging

Tinkerhub uses [debug](https://github.com/visionmedia/debug) for debug logging.
Internal Tinkerhub-things live in the namespace `th` and things belong to the
namespace `things`. Logging for both can be activated with `th*`:

```
$ DEBUG=th\* node fileToRun.js
```

Other interesting namespaces include the `ataraxia` which outputs information
about the network and `dwaal` that outputs information about the key-value
storage used by things (via [abstract-things](https://github.com/tinkerhub/abstract-things)).

## State handling

State is important in Tinkerhub, most things will have the capability `state`.
State can be read and inspected by calling the `state()` action:

```javascript
collection.state()
  .then(state => console.log('State is', state));
```

Things can also advertise that they are capabable of capturing and restoring
state via the capability `restorable-state`. Things that are restorable will
have these three actions available:

* `restorableState(): Array[string]` - Get all of the state keys that can be restored.
* `captureState(): Object` - Capture the current state as an object.
* `setState(Object)` - Set the state of the thing.

To capture and restore the state the extra functions `captureState(collection)`
and `restoreState(collection, state)` are available in `tinkerhub/state`:

```javascript
const { captureState, restoreState } = require('tinkerhub/state');
```

An example of using capturing and restoring could be doing something like this
to capture the state of lights, turn them off and a few seconds after restore
their original state:

```javascript
const th = require('tinkerhub');
const { captureState, restoreState } = require('tinkerhub/state');

let capturedState;
let lights = th.get('type:light', 'cap:restorable-state')

lights.awaitThings()
  
  // When lights are available, capture their state
  .then(() => captureState(lights))
  
  // Handle the state and request lights to be turned off
  .then(state => {
    capturedState = state;
    return lights.turnOff();
  })

  // Set a timeout for restoring the state five seconds after turning off
  .then(() => setTimeout(() => {
    // Restore the state
    restoreState(lights, capturedState)

      // Log any errors
      .catch(th.errorHandler)

      // Exit the process when state has been restored
      .then(() => process.exit());
  }, 5000))

  // Log any errors
  .catch(th.errorHandler);
```

## Network

Tinkerhub creates a mesh network between instances. It is possible to use
the library in several NodeJS instances on a single machine. Tinkerhub will
manage the connections to other machines so that only a single network connection
between machines exist.

A network may come to look a bit like this, where each machine connect to
each other machine, but instances within a machine mainly connect to
themselves.

```
+------------------+
|Machine #1        |
|                  |
| +--+     +--+    |
| |  +-----+  +--------+         +------------------+
| +--+     +-++    |   |         |Machine #2        |
|            |     |   |         |                  |
+------------------+   |         | +--+             |
             +---------------------+  |             |
                       |         | ++-+             |
                       |         |  |               |
                       |         +------------------+
                       |            |
       +---------------------+      |
       |Machine #3     |     |      |
       |               |     |      |
       |  +--+        ++-+   |      |
       |  |  +--------+  +----------+
       |  +--+        ++-+   |
       |               |     |
       |       +--+    |     |
       |       |  +----+     |
       |       +--+          |
       +---------------------+
```
