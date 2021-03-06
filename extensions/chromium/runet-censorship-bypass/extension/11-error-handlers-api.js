'use strict';

{ // Private namespace

  function errorJsonReplacer(key, value) {

    // fooWindow.ErrorEvent !== barWindow.ErrorEvent
    if (!( value && value.constructor
      && ['Error', 'Event'].some(
        (suff) => value.constructor.name.endsWith(suff)
      )
    )) {
      return value;
    }
    const alt = {};

    Object.getOwnPropertyNames(value).forEach(function(key) {

        alt[key] = value[key];

    }, value);

    for(const prop in value) {
      if (/^[A-Z]/.test(prop)) {
        // MOUSEMOVE, CLICK, KEYUP, NONE, etc.
        continue;
      }
      alt[prop] = value[prop];
    }

    if (value.constructor.name === 'ErrorEvent') {
      for(const circularProp of
        [  // First line are circular props.
          'target', 'srcElement', 'path', 'currentTarget',
          'bubbles', 'cancelBubble', 'cancelable', 'composed',
          'defaultPrevented', 'eventPhase', 'isTrusted', 'returnValue',
          'timeStamp']) {
        delete alt[circularProp];
      }
    }

    if (value.name) {
      alt.name = value.name;
    }

    return alt;

  }

  const openAndFocus = function openAndFocus(url) {

    chrome.tabs.create(
      {url: url},
      (tab) => chrome.windows.update(tab.windowId, {focused: true})
    );

  };

  const ifPrefix = 'if-on-';
  const extName = chrome.runtime.getManifest().name;

  window.apis.errorHandlers = {

    state: window.utils.createStorage('handlers-'),

    viewErrorVoid(type = window.utils.mandatory(), err) {

      let errors = {};
      if (err) {
        errors[type] = err;
      } else {
        errors = this.idToError;
      }
      const json = JSON.stringify(errors, errorJsonReplacer, 0);
      openAndFocus(
        'http://rebrand.ly/ac-error/?json=' + encodeURIComponent(json) +
          (type ? '&type=' + encodeURIComponent(type) : '') +
          '&version=' + chrome.runtime.getManifest().version
      );

    },

    getEventsMap() {

      return new Map([
        ['pac-error', 'ошибки PAC скриптов'],
        ['ext-error', 'ошибки расширения'],
        ['no-control', 'утеря контроля над настройками'],
      ]);

    },

    switchVoid(onOffStr, eventName) {

      if (!['on', 'off'].includes(onOffStr)) {
        throw new TypeError('First argument bust be "on" or "off".');
      }
      for(
        const name of (eventName ? [eventName] : this.getEventsMap().keys() )
      ) {
        this.state( ifPrefix + name, onOffStr === 'on' ? 'on' : null );
      }

    },

    isOn(eventName) {

      return this.state( ifPrefix + eventName );

    },

    ifNotControlled: null,

    isNotControlled(details) {

      this.ifNotControlled = window.utils.areSettingsNotControlledFor(details);
      if (this.ifNotControlled) {
        chrome.browserAction.setIcon({
          path: './icons/default-grayscale-128.png',
        });
      } else {
        chrome.browserAction.setIcon( {path: './icons/default-128.png'} );
      }
      return this.ifNotControlled;

    },

    idToError: {},

    mayNotifyVoid(
      id, title, errOrMessage,
      {
        icon = 'default-128.png',
        context = extName,
        ifSticky = true,
      }
    ) {

      if ( !this.isOn(id) ) {
        return;
      }
      this.idToError[id] = errOrMessage;
      const message = errOrMessage.message || errOrMessage.toString();
      chrome.notifications.create(
        id,
        {
          title: title,
          message: message,
          contextMessage: context,
          requireInteraction: ifSticky,
          type: 'basic',
          iconUrl: './icons/' + icon,
          appIconMaskUrl: './icons/default-mask-128.png',
          isClickable: true,
        }
      );

    },

    installListenersOnAsync(win, name, cb) {

      win.addEventListener('error', (errEvent) => {

        console.warn(name + ':GLOBAL ERROR', errEvent);
        this.mayNotifyVoid('ext-error', 'Ошибка расширения', errEvent,
          {icon: 'ext-error-128.png'});

      });

      win.addEventListener('unhandledrejection', (event) => {

        console.warn(name + ': Unhandled rejection. Throwing error.');
        event.preventDefault();
        console.log('ev', event);
        throw event.reason;

      });

      if (cb) {
        // setTimeout changes error context.
        setTimeout(cb, 0);
      }

    },

  };

  const handlers = window.apis.errorHandlers;

  // Initialization
  // ==============

  chrome.proxy.settings.get(
    {},
    (details) => handlers.isNotControlled(details)
  );

  chrome.notifications.onClicked.addListener( function(notId) {

    chrome.notifications.clear(notId);
    if(notId === 'no-control') {
      return openAndFocus(
        window.utils.messages.searchSettingsForUrl('proxy')
      );
    }
    handlers.viewErrorVoid(notId);

  });

  handlers.installListenersOnAsync(window, 'BG');

  chrome.proxy.onProxyError.addListener((details) => {

    if (handlers.ifNotControlled) {
      return;
    }
    /*
      Example:
        details: "line: 7: Uncaught Error: This is error, man.",
        error: "net::ERR_PAC_SCRIPT_FAILED",
        fatal: false,
    */
    console.warn('PAC ERROR', details);
    // TOOD: add "view pac script at this line" button.
    handlers.mayNotifyVoid('pac-error', 'Ошибка PAC!',
      details.error + '\n' + details.details,
      {icon: 'pac-error-128.png'}
    );

  });

  chrome.proxy.settings.onChange.addListener((details) => {

    console.log('Proxy settings changed.', details);
    const noCon = 'no-control';
    if ( handlers.isNotControlled(details) ) {
      handlers.mayNotifyVoid(
        noCon,
        chrome.i18n.getMessage('noControl'),
        chrome.i18n.getMessage('which'),
        {icon: 'no-control-128.png', ifSticky: false}
      );
    } else {
      chrome.notifications.clear( noCon );
    }

  });

}
