# 1-sync-pac-script-with-pac-provider.js

```js

window.antiCensorRu =

{
  pacProviders: {
    providerName: {
      ...properties...
      ifCustomizable: Boolean
      configs: Configs
    }
  },

  syncWithPacProvider CALLS:
    setPacScriptFromProvider(pacProvider)
    updatePacProxyIps(pacProvider)
    setAlarms
};

asyncGroup
httpGet
getOneDnsRecord
getDnsRecords
getIpDnsRecords
updatePacProxyIps
setPacScriptFromProvider
```

# New Architecture

```js

class PacScript {

  Description:
    Sets PAC script from url or string

  Fields:

    lastInstallStamp

  Methods:

    installFromUrl(pacUrl)
      CALLS:
        downloads pac...
        installFromString(pacStr)

    installFromString(pacStr)
      CALLS:
        this.lastInstallStamp = now
        this.onInstall._callListeners()

    onInstall:
      addListener
      _callListeners
        
    uninstall
      CALLS:
        chrome.proxy.clear

};

class PacConfigPlugin {

  Fields:
    name
    scheme

};

class PacConfigs {

  Fields:
  
    set defauld(newDefauld) {
      this.assertScheme( this._merge( newDefauld, this.custom ) );
    }
    custom: {...}
    
    _schemes: {
      root: rootScheme,
      plugins: {
        common:...// STOPPED HERE
      }
    }

  Methods:
  
    constructor(defauldConfigs, ...plugins)
      CALLS:
        this.configs.defauld = defauldConfigs
    
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

    assertScheme(configs )
      CALLS:
        configs ? check(configs) : check(this.get())
};

const ConfigurablePacScript = (SuperPacScript) => class extends SuperPacScript {

  Fields:

    configs: pacConfig

  Methods:
  
    installFromString(pacStr)
      CALLS:
        1. this.configs.defauld = this.extractConfigs(pacStr);
        3. newPacStr = this.applyConfigs( pacStr );
        3. super.installFromString( newPacStr );

    extractConfigs(pacStr)
    applyConfigs(pacStr)
      CALLS:
        this.jsonifyConfigs
    jsonifyConfigs()

};

class AnticensorPacScript extends ConfigurablePacScript {

  Fields:

    ip2proxy

  Methods:

    constructor(...args) {
      super(...args);
      this.onInstall.addListener( (pacStr) => {
      
        assertScheme(this.configs)
        this.ip2proxy = this.configs.get('.ip2proxy'); // or throws error

      } );
    }
   
    assertScheme()
    extractConfigs(pacStr)
      assert( configs.get('plugins.anticensorship') === "0.0.0.15" );
      super.extractConfigs();
  
    applyConfigs(pacStr)

};

const SyncingPacScript = (SuperPacScript) => class extends SuperPacScript {

  Description:
    Sets PAC script from url, periodically if needed.
    One instance corresponds to one pac provider

  Fields:
  
    _pacUrl
    _alarmName: 'Minimalistic PAC setter alarm'
    _syncPeriodInMinutes

  Methods:

    constructor(pacUrl, { when: ..., periodInMinutes: ... })
      CALLS:
        this._pacUrl = pacUrl
        chrome.alarms.onAlarm.addListener( (alarm) => {

          if (alarm.name === this._alarmName) {
            this.sync();
          }

        });
        nextPacUpdateStamp = this.lastInstallStamp + periodInMinutes
        chrome.alarms.create( this._alarmName, { when: nextPacUpdateStamp, periodInMinutes: ... } );
      RETURNS:
        nextPacUpdateStamp

    sync()
      CALLS:
        this.installFromUrl(this.pacUrl);
        
    uninstall()
      CALLS:
        chrome.alarms.clear( this._alarmName );
        super.uninstall

};

class ExtendedPacScript extends SyncingPacScript(ConfigurablePacScript(PacScript)) {}

```