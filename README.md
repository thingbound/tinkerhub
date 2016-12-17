# Tinkerhub

Tinkerhub is a home automation library that connects your devices and lets you
tinker with them. This repository contains the main library for discovering,
registering and interacting with devices.

## Joining the Tinkerhub network

Tinkerhub will automatically connect to other instances on the same local
network and make their devices available to the local instance. This is done
automatically on `require('tinkerhub')`.

```javascript
// Asynchronously connect to instances on the local network
const th = require('tinkerhub');
```

## Discovering devices

Devices can join or leave the network at any time. It's possible to listen
to `deviceAvailable` and `deviceUnavailable` to be notified when this happens.

```javascript
th.devices.on('deviceAvailable', function(device) {
    console.log('New device', device);
})
```

If you know the identifier of a given device you can fetch it via the `getSpecific`
function.

```javascript
const device = th.devices.getSpecific('deviceIdHere');
console.log('Got ', device);
```

In most cases it's probably easier to use device collection to find devices.
Collections can be created from tags or from a custom filter function.

```javascript
// Get all devices
const allDevices = th.devices.all();

// Fetch devices via one or more tags
const lights = th.devices.get('type:light');

// Filter via a function when a new device is available
const devicesWithStatusAction = th.devices.get(function(device) {
    return device.metadata.actions[status];
});
```

Collections also support the `deviceAvailable` and `deviceUnavailable` events.

## Working with devices and collections

### Metadata for an individual device

Devices have metadata associated with them, which contains information about
their unique identifier, their type and capabilities and the actions they
support.

```javascript
console.log(device.metadata.id); // "idOfDevice"
console.log(device.metadata.name); // "Human-readable name if any"
console.log(device.metadata.types); // [ 'light', 'otherType' ]
console.log(device.metadata.capabilities); // [ 'dimmable', 'colors' ]
```

A device may be of one or more types, meaning it fulfills the API of those
types. For example a device with type `light` should support `turnOn` and
`turnOff`.

Capabilities are softer and indicate extended functions a certain device
supports. For a light this might be that it is dimmable and for a media player
it might be that it support video.

### Listening for events

Devices  support events, which can easily be listened for via `on`.

```javascript
// Start listening
const handle = device.on('turnedOn', function() {
    // Device has been turned on
});

// To stop listening
handle.stop();
```

The same is true for collections, where an event will be trigged if any
device in the collection emits an event:

```javascript
th.devices.tagged('type:light').on('turnedOn', function() {
    // this refers to the device
    device.turnOff();
});
```

### Performing actions

All devices support actions, which can be invoked on both devices and
collections:

```javascript
device.turnOn(); // Turn on the device asynchronously

th.devices.tagged('type:light').turnOn(); // Turns on all devices
```

Actions return promises (via [Q](http://documentup.com/kriskowal/q/)) that
can be used to act on the result of the invocation.

```javascript
device.status()
    .then(function(status) {
        console.log('status is', status);
    });

th.devices.tagged('type:light').status()
    .then(function(statuses) {
        console.log(statuses); // Object with deviceId = result
    });
```

## Creating a device

Devices are created by binding an object to a unique device id. It is recommended
that device ids are prefixed with their module name, `module:id` such as
`hue:00FFCC33DD` or `chromecast:TV`.

When a device is registered it is made available over the network, so devices
should only be registered when they are actually available.

```javascript
th.devices.register('test:uniqueId', {
    metadata: {
        name: 'Test Device',
        type: 'deviceType',
        capabilities: [ 'status' ]
    },

    say: function(message) {
        console.log('Someone told me to say:', message);
    },

    status: function() {
        return _privateStatusHelper();
    },

    _privateStatusHelper: function() {
        return { ... };
    }
})
```

### Metadata

The property `metadata` is special and is used to define extra information about
the device, this includes the `type` and `capabilities` of the device.

Both `type` and `capabilities` can be either a single string or an array of string.

A name for the device can also be defined via the `name` property.

### Private functions and properties

Anything prefixed with `_` will be treated as private and will not be invokable
over the network.

### Types and capabilities

Tinkerhub supports registering contracts on how different types of devices work.
This is used to create a uniform API for devices of the same type, for example
a device that is a light can always be turned on or off.

Certain capabilities also have contracts that apply regardless of the device type,
these are currently `state` and `power`.

These contracts are checked when a device is registered and Tinkerhub will
refuse to register the device if it finds any errors.

Registration of new types can be done via the type registry, here is an example
of a type `cookie-jar`:

```javascript
th.types.registerDeviceType('cookie-jar')
    .action('open').done()
    .action('close').done()
    .action('setOpen').argument('boolean', 'If the jar should be open').done()
    .action('isOpen').returns('boolean', 'If the jar is open or not').done()
    .done();
```

It is possible to specify that certain actions are only available when the
device also has a certain capability as well as enforcing that a certain
device type always has a capability. This is how one might define a light that
may be dimmable:

```javascript
th.types.registerDeviceType('light')
    .requireCapability('state', 'power')
    .when('dimmable')
        .action('setBrightness')
            .argument('percentage', 'Brightness Percentage')
            .returns('object', 'The new state')
            .done()
        .action('increaseBrightness')
            .argument('percentage', 'Percentage to increase')
            .returns('object', 'The new state')
            .done()
        .action('decreaseBrightness')
            .argument('percentage', 'Percentage to decrease')
            .returns('object', 'The new state')
            .done()
        .done()
    .done();
```

Any `light`-devices registered that define that they have the capability
`dimmable` will then be checked so that the dimmable actions are defined.

## Tags

Devices support user defined tags via their metadata. These tags are persisted
on the same machine as a device is registered. In the API tags are merged with
system generated tags such as type tags and capability tags.

This can be used to create groups of devices, such as all devices found in a
certain room. This allows for things such as this:

```javascript
// Fetch lights in the livingroom and turn the om
th.devices.tagged('type:light', 'livingroom').turnOn();

// Log all devices found in livingroom
console.log(th.devices.tagged('livingroom'));
```

### Modify tags via the API

The device metadata object contains an API that can be used to the user defined
tags of a device. Currently the prefixes `type:` and `cap:` are reserved.

```javascript
console.log(device.metadata.tags); // Get all of the tags

device.metadata.tag('tag1', ..., 'tagN'); // Add tags to the device

device.metadata.removeTag('tag1', ..., 'tagN'); // Remove tags from the device
```
