'use strict';

{

  const IF_DEBUG = true;

  if (!IF_DEBUG) {
    // I believe logging objects precludes them from being GCed.
    // I also don't remove logs for sake of client-side troubleshooting
    // (though no one sent me logs so far).
    ['log', 'warn', 'error'].forEach( (meth) => {
      const _meth = window.console[meth].bind(console);
      window.console[meth] = function(...args) {

        _meth(...args.map((a) => '' + a));

      };
    });
  }

  const self = window.utils = {

    mandatory() {

      throw new TypeError('Missing required argument. ' +
        'Be explicit if you swallow errors.');

    },

    throwIfError(err) {

      if(err) {
        throw err;
      }

    },

    checkChromeError(betterStack) {

      // Chrome API calls your cb in a context different from the point of API
      // method invokation.
      const err = chrome.runtime.lastError || chrome.extension.lastError;
      if (err) {
        const args = ['API returned error:', err];
        if (betterStack) {
          args.push('\n' + betterStack);
        }
        console.warn(...args);
      }
      return err;

    },

    chromified(cb = self.mandatory(), ...replaceArgs) {

      const stack = (new Error()).stack;
      // Take error first callback and convert it to chrome api callback.
      return function(...args) {

        if (replaceArgs.length) {
          args = replaceArgs;
        }
        const err = self.checkChromeError(stack);
        // setTimeout fixes error context.
        setTimeout( cb.bind(null, err, ...args), 0 );

      };

    },

    getProp(obj, path = self.mandatory()) {

      const props = path.split('.');
      if (!props.length) {
        throw new TypeError('Property must be supplied.');
      }
      const lastProp = props.pop();
      for( const prop of props ) {
        if (!(prop in obj)) {
          return undefined;
        }
        obj = obj[prop];
      }
      return obj[lastProp];

    },

    createStorage(prefix) {

      return function state(key, value) {

        key = prefix + key;
        if (value === null) {
          return localStorage.removeItem(key);
        }
        if (value === undefined) {
          const item = localStorage.getItem(key);
          return item && JSON.parse(item);
        }
        if (value instanceof Date) {
          throw new TypeError('Converting Date format to JSON is not supported.');
        }
        localStorage.setItem(key, JSON.stringify(value));

      }

    },

    areSettingsNotControlledFor(details) {

      return ['controlled_by_other', 'not_controllable']
        .some( (prefix) => details.levelOfControl.startsWith(prefix) );

    },

    messages: {

      searchSettingsForUrl(niddle) {

        return 'chrome://settings/search#' + (chrome.i18n.getMessage(niddle) || niddle);

      },

      whichExtensionHtml() {

        return chrome.i18n.getMessage('noControl') +
          ` <a href="${ this.searchSettingsForUrl('proxy') }">
            ${ chrome.i18n.getMessage('which') }
          </a>`;

      },

    },

  };

  window.apis = {};

}
