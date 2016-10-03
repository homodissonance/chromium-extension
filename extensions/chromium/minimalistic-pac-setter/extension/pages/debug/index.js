'use strict';
/*
chrome.runtime.getBackgroundPage( (backgroundPage) => {

});
*/
chrome.proxy.settings.get({}, (details) => {

  document.querySelector('#out').innerText = details.value.pacScript.data;

});
