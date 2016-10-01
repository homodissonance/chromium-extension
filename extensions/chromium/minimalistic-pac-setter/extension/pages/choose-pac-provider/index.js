'use strict';

chrome.runtime.getBackgroundPage( backgroundPage => {

  function getStatus() {
    return document.querySelector('#status');
  }

  function setStatusTo(msg) {
    var status = getStatus();
    if (msg) {
      status.classList.remove('off');
      status.innerHTML = msg;
    } else
      status.classList.add('off');
  }

  const antiCensorRu = backgroundPage.antiCensorRu;

  // Set update date

  function setDate() {
    var dateForUser = 'никогда';
    if( antiCensorRu.lastPacUpdateStamp ) {
      var diff = Date.now() - antiCensorRu.lastPacUpdateStamp;
      var units = ' мс';
      var gauges = [
        [1000, ' с'],
        [60, ' мин'],
        [60, ' ч'],
        [24, ' дн'],
        [7, ' недель'],
        [4, ' месяцев'],
        [12, ' г']
      ];
      for(var g of gauges) {
        var diffy = Math.floor(diff / g[0]);
        if (!diffy)
          break;
        diff = diffy;
        var units = g[1];
      }
      dateForUser = diff + units + ' назад';
    }

    var dateElement = document.querySelector('.update-date');
    dateElement.innerText = dateForUser;
    dateElement.title = new Date(antiCensorRu.lastPacUpdateStamp).toLocaleString('ru-RU');
  }

  setDate();
  chrome.storage.onChanged.addListener( changes => changes.lastPacUpdateStamp.newValue && setDate() );

  // Close button

  document.querySelector('.close-button').onclick = () => window.close();

  // Radios

  var currentRadio = () => {
    var id = antiCensorRu.currentPacProviderKey || 'none';
    return document.querySelector('#'+id);
  }
  var checkChosenProvider = () => {
    var radio = currentRadio();
    radio.checked = true;
  }
  var triggerChosenProvider = () => {
    var event = document.createEvent('HTMLEvents');
    event.initEvent('change', false, true);
    currentRadio().dispatchEvent(event);
  }

  var ul = document.querySelector('#list-of-providers');
  var _firstChild = ul.firstChild;
  for( var providerKey of Object.keys(antiCensorRu.pacProviders) ) {
    var li = document.createElement('li');
    li.innerHTML = '<input type="radio" name="pacProvider" id="'+providerKey+'"> <label for="'+providerKey+'">'+providerKey+'</label> <a href class="link-button checked-radio-panel">[обновить]</a>';
    li.querySelector('.link-button').onclick = () => {triggerChosenProvider(); return false;};
    ul.insertBefore( li, _firstChild );
  }

  var radios = [].slice.apply( document.querySelectorAll('[name=pacProvider]') );
  for(var radio of radios) {
    radio.onchange = function(event) {
      var pacKey = event.target.id;
      if (pacKey === 'none')
        return antiCensorRu.clearPac();

      function enableDisableInputs() {
        var inputs = document.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++)
          inputs[i].disabled = !inputs[i].disabled;
      }

      enableDisableInputs();
      setStatusTo('Установка...');
      antiCensorRu.installPac(pacKey, (err) => {
        if (!err) {
          setStatusTo('PAC-скрипт установлен.');
        }
        else {
          var ifNotCritical = err.clarification && err.clarification.ifNotCritical;

          var message = '';
          var clarification = err.clarification;
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
          getStatus().querySelector('.link-button').onclick = function() {
            var div = document.createElement('div');
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
      });
    }
  }

  setStatusTo('');
  checkChosenProvider();
  if (antiCensorRu.ifFirstInstall) {
    triggerChosenProvider();
  }

  // Custom hosts

  if ( !antiCensorRu.customHosts.ifEnabled ) {
    return;
  }

  document.querySelector('#proxy-also').checked = true;

  const removeCustomHost = function () {

    const li = this.parentNode;
    const host = li.querySelector('span').innerText;
    li.remove();
    delete antiCensorRu.customHosts.hash[ punycode.toASCII( host ) ];
    antiCensorRu.pushToStorage();
    return false;

  };

  const appendHost = (host) => {

    const li = document.createElement('li');
    li.innerHTML = '<span>' + punycode.toUnicode( host ) + '</span> <a href style="float: right">[удалить]</a>';
    document.querySelector('#custom-hosts-list').appendChild(li);
    li.querySelector('a').onclick = removeCustomHost;

  };

  for( let host of Object.keys( antiCensorRu.customHosts.hash ).sort() ) {
    appendHost( host );
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
    appendHost( punyHost );
    antiCensorRu.customHosts.hash[ punyHost ] = true;
    antiCensorRu.pushToStorage();
    // TODO: bbbbbb

  };

});
