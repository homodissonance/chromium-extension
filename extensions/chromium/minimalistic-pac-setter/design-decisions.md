# PAC Configs

1. PAC configs are part of the PAC script itself, not part of a separate file. The fewer requests, the better.
2. Retrieving and changing configs must be easy, as easy as search/replace and parsing JSON, there should
be no need for lexical parsing of ecmascript.
3. Non-configured PAC script may still be a valid PAC script even if configs are not touched
   (so default config values of PAC script are used).
4. PAC script __may require additional configs__ to be defined before it may be used. This may be used for legal protection.
There must be a way to explicitly tell client what is required.
5. Configs schema will be changing. It won't be feasible to update all clients at once in short time. URLs used by old
   clients must still contain old configs schema, for new configs new URLs must be provided within the new client version.
   So we come to __versioning__.
   Versioning may be used for:

    * rejecting PAC scripts with non-matching version
    * migrating client's configs to newer versions (client-side)

  Migrations bloat the client codebase, so minimum number of migration instructions should be kept on the cleint,
  migration scripts may be lazy loaded from the server on each update.
6. User may change configs, changed configs should be __validated with a schema__ on the client.
7. Configs are composed of __plugins__, each plugin has name, version and schema.
   This contributes to:
   
     * problem decomposition, separation of concerns
     * possible wider adoption of the standard proposed (like somebody needs it)

## By Example

```js
// File: proxy-0.0.0.15.pac
var CONF = {"_begin":"CONFIGS_BEGIN",

  "plugins": {
    "common": "0.0.0.15",
    "anticensorship": "0.0.0.15"
  },

  "common": {
    "exceptions": {
      "ifEnabled": true,
      "hostsHash": {
        "youtube.com": false,
        "archive.org": true,
        "bitcoin.org": true
      }
    },
    "proxiesHash": {
      "HTTPS": ["proxy.antizapret.prostovpn.org:3143", "gw2.anticenz.org:443"],
      "PROXY": ["proxy.antizapret.prostovpn.org:3128", "gw2.anticenz.org:8080"]
    },
    
    "ifHttpsProxyOnly":  false,
    "ifHttpsUrlsOnly":   false,
    "customProxyString": false,
  },

  "anticensorship": {
    "ifUncensorByIp":   true,
    "ifUncensorByHost": true,
    "ip2proxy": __IP2PROXY__
  },

  "_end":"CONFIGS_END"};

// Chrome Extension (Client)

class PacConfigPlugin {

  Fields:

    name
    version
    scheme

};

class PacConfigs {

  Fields:
  
    custom: {...}
    set defauld(newDefauld) {
      this.assertSchemes( this._merge( newDefauld, this.custom ) );
      return newDefauld;
    }
    get defauld(value) {
      return value;
    }

    _schemas: {
      root: rootSchema, // { plugins: ...schema... }
        ???
        plugins: {
          ...e.g.:
          common: ...PacConfigPlugin...
          anticensorship: ...PacConfigPlugin...
          ...
        }
    }

  Methods:
  
    constructor(defauldConfigs, ...plugins)
      CALLS:
        plugins.forEach( (plugin) => this.usePlugin(plugin) );
        this.configs.defauld = defauldConfigs

    usePlugin(plugin)
      CHANGES: _schemas

    _merge(target, source)
    
    getCustomObject(pathStr)
      more convenient for creating custom props than basic set
      DOES:
        returns modifiable prop of custom without any merging
        returns only values with prototype Object
        if prop is not defined:
          1. checks that defauld has Object on the same path
          2. creates {} on custom and returns it.
    get(pathStr, ifStrict = true)
      DOES: applies custom to defauld, gets prop __strictly__
      RETURNS: merged __copy__
    set(pathStr)
      CALLS:
        sets prop of custom configs
        this.assertScheme()

    assertScheme(configs)
      CALLS:
        configs ? check(configs) : check(this.get())
};

```