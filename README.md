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

Tinkerhub requires at least Node 6.0.0.

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
to `available` and `unavailable` to be notified when this happens.

```javascript
th.on('available', thing => {
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

Collections also support the `available` and `unavailable` events.

```javascript
const switchableLights = th.get('type:light', 'cap:switchable');

switchableLights.on('available', light => console.log('Found a light', light));

switchableLights.destroy(); // Destroy the collection and remove all listeners
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
is defined in another project called [Appliances](https://github.com/tinkerhub/appliances).

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

## Building a thing

Things in Tinkerhub are based on the library [abstract-things](https://github.com/tinkerhub/appliances).
More specific types and capabilities are available in [Appliances](https://github.com/tinkerhub/appliances),
such as sensors, lights, humidifiers, switches and so on.

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
th.register(new Timer());
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

      return new SpecificThing(thing)
        .init();
    })
  );
});
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
