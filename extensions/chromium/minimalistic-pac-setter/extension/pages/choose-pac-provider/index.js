'use strict';

chrome.runtime.getBackgroundPage( (backgroundPage) => {

  const getStatus = () => document.querySelector('#status');

  const setStatusTo = function (msg) {

    const status = getStatus();
    if (!msg) {
      return status.classList.add('off');
    }
    status.classList.remove('off');
    status.innerHTML = msg;

  };

  const antiCensorRu = backgroundPage.antiCensorRu;

  // Set update date

  const setDate = function () {

    let dateForUser = 'никогда';
    if( antiCensorRu.lastPacUpdateStamp ) {
      let diff = Date.now() - antiCensorRu.lastPacUpdateStamp;
      let units = ' мс';
      const gauges = [
        [1000, ' с'],
        [60, ' мин'],
        [60, ' ч'],
        [24, ' дн'],
        [7, ' недель'],
        [4, ' месяцев'],
        [12, ' г']
      ];
      for(const g of gauges) {
        const diffy = Math.floor(diff / g[0]);
        if (!diffy)
          break;
        diff = diffy;
        units = g[1];
      }
      dateForUser = diff + units + ' назад';
    }

    const dateElement = document.querySelector('.update-date');
    dateElement.innerText = dateForUser;
    dateElement.title = new Date(antiCensorRu.lastPacUpdateStamp).toLocaleString('ru-RU');

  };

  setDate();
  chrome.storage.onChanged.addListener( (changes) => changes.lastPacUpdateStamp.newValue && setDate() );

  // Close button

  document.querySelector('.close-button').onclick = () => window.close();

  // Radios

  const chosenRadio = () => {

    const id = antiCensorRu.currentPacProviderKey || 'none';
    return document.querySelector('#' + id);

  };
  const checkChosenProvider = () => {

    const radio = chosenRadio();
    radio.checked = true;

    // On/off site exceptions.

    const providerName = radio.id;
    const customizable = document.querySelectorAll('.customizable')
    if ( providerName !== 'none' && antiCensorRu.pacProviders[ providerName ].ifCustomizable ) {
      customizable.forEach( (s) => s.style.display = 'block' );
    }
    else {
      customizable.forEach( (s) => s.style.display = 'none'  );
    }

  };
  const triggerChosenProvider = () => {

    const event = document.createEvent('HTMLEvents');
    event.initEvent('change', false, true);
    chosenRadio().dispatchEvent(event);

  };

  +function () {

    const ul = document.querySelector('#list-of-providers');
    const _firstChild = ul.firstChild;
    for( const providerKey of Object.keys(antiCensorRu.pacProviders) ) {

      const li = document.createElement('li');
      li.innerHTML = `<input type="radio" name="pacProvider" id="${providerKey}"> <label for="${providerKey}">${providerKey}</label> <a href class="link-button pac-update-button">[обновить]</a>`;
      li.querySelector('.link-button').onclick = () => { triggerChosenProvider(); return false; };
      ul.insertBefore( li, _firstChild );

    }

  }();

  const radios = [].slice.apply( document.querySelectorAll('[name=pacProvider]') );
  for(const radio of radios) {
    radio.onchange = function(event) {

      const cb = checkChosenProvider;

      const pacKey = event.target.id;
      if (pacKey === 'none') {
        return antiCensorRu.clearPac( cb );
      }

      const enableDisableInputs = function () {

        const inputs = document.querySelectorAll('input');
        for (let i = 0; i < inputs.length; i++) {
          inputs[i].disabled = !inputs[i].disabled;
        }

      }

      enableDisableInputs();
      setStatusTo('Установка...');
      antiCensorRu.installPac(pacKey, (err) => {

        if (!err) {
          setStatusTo('PAC-скрипт установлен.');
        }
        else {
          const ifNotCritical = err.clarification && err.clarification.ifNotCritical;

          let message = '';
          let clarification = err.clarification;
          do {
            message = message +' '+ (clarification && clarification.message || err.message || '');
            clarification = clarification.prev;
          } while( clarification );
          message = message.trim();
          setStatusTo(
`<span style="color:red">${ifNotCritical ? 'Некритичная ошибка.' : 'Ошибка!'}</span>
<br/>
<span style="font-size: 0.9em; color: darkred">${message}</span>
<a href class="link-button">[Ещё&nbsp;подробнее]</a>`
          );
          getStatus().querySelector('.link-button').onclick = function () {

            const div = document.createElement('div');
            div.innerHTML = `
Более подробную информацию можно узнать из логов фоновой страницы:<br/>
<a href class="ext">chrome://extensions</a> › Это расширение › Отладка страниц: фоновая страница › Console (DevTools)
<br>
Ещё: ${JSON.stringify({err: err, stack: err.stack})}
`;
            getStatus().replaceChild(div, this);
            div.querySelector('.ext').onclick = () => {

              chrome.tabs.create({ url: 'chrome://extensions?id='+ chrome.runtime.id });
              return false;

            }
            return false;

          };
        };
        enableDisableInputs();
        return cb();

      });

    }
  }

  setStatusTo('');
  checkChosenProvider();
  if (antiCensorRu.ifFirstInstall) {
    triggerChosenProvider();
  }

  // Custom hosts

  const proxyAlso = document.querySelector('#proxy-also');
  proxyAlso.onchange = function () {

    antiCensorRu.configs.set('exceptions.ifEnabled', this.checked);
    antiCensorRu.pushToStorage();

  };
  proxyAlso.checked = antiCensorRu.configs.get('exceptions.ifEnabled');

/*  if ( !proxyAlso.checked ) {
    return;
  }*/

  const removeCustomHost = function () {

    const li = this.parentNode;
    const host = li.querySelector('span').innerText;
    li.remove();
    delete antiCensorRu.configs.get('exceptions.hostsHash')[ punycode.toASCII( host ) ];
    antiCensorRu.pushToStorage();
    return false;

  };

  const appendHostToUi = (host) => {

    const li = document.createElement('li');
    li.innerHTML = '<span>' + punycode.toUnicode( host ) + '</span> <a href style="float: right">[удалить]</a>';
    document.querySelector('#list-of-custom-hosts').appendChild(li);
    li.querySelector('a').onclick = removeCustomHost;

  };

  for( let host of Object.keys( antiCensorRu.configs.get('exceptions.hostsHash') ).sort() ) {
    appendHostToUi( host );
  }

  const hostToAdd = document.querySelector('#host-to-add');

  const handleHostname = (userInput) => {

    // If no protocol, assume http.
    if (! /^[^:]+:\/\//.test( userInput ) ) {
      userInput = 'http://' + userInput;
    }
    return new URL( userInput ).hostname;
  };

  hostToAdd.onpaste = function (ev) {

    // Stop data actually being pasted into div
    ev.stopPropagation();
    ev.preventDefault();

    // Get pasted data via clipboard API
    let clipboardData = ev.clipboardData || window.clipboardData;
    let pastedData = clipboardData.getData('Text');

    this.value = punycode.toUnicode( handleHostname( pastedData ) );
    return false;

  };

  chrome.tabs.query({ active: true, currentWindow: true }, (tabArray) => {

    const tab = tabArray.pop();
    if ( !tab || tab.url.startsWith('chrom') ) {
      return;
    }
    hostToAdd.value = punycode.toUnicode( new URL( tab.url ).hostname.replace(/^www./, '') );

  });

  document.querySelector('#add-host-button').onclick = () => {

    const punyHost = handleHostname( hostToAdd.value );
    const hosts = antiCensorRu.customs.exceptions.hostsHash;
    if ( !(punyHost in hosts) ) {
      appendHostToUi( punyHost );
      antiCensorRu.configs.set('exceptions.hostsHash[ punyHost ]', true); // STOPPED HERE
      // TODO: update pac
      antiCensorRu.pushToStorage();
    }

  };

  // Security

  const sproxy = document.querySelector('#only-https-proxy');
  const surls  = document.querySelector('#only-https-urls')
  const types = antiCensorRu.customs.proxy.typesHash;
  sproxy.onchange = function (event) {

    if (this.checked) {
      Object.keys(types).forEach( (t) => types[t] = false );
      types.HTTPS = true;
    }
    else {
      Object.keys(types).forEach( (t) => types[t] = true );
    }
    antiCensorRu.pushToStorage();

  };
  surls.onchange = function (event) {

    antiCensorRu.customs.ifHttpsUrlsOnly = this.checked;
    antiCensorRu.pushToStorage();

  };

  sproxy.checked = antiCensorRu.customs.proxy.isHttpsOnly();
  surls.checked = antiCensorRu.customs.ifHttpsUrlsOnly;

  // Debug

  const dlink = document.querySelector('#debug-link');
  dlink.onclick = () => chrome.tabs.create({ url: chrome.extension.getURL('./pages/debug/index.html') });
});
