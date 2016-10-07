'use strict';

const editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/javascript");

document.querySelector('#read-button').onclick = () => {

  chrome.proxy.settings.get({}, (details) => {

    editor.setValue( details.value.pacScript.data );

  });

};


document.querySelector('#save-button').onclick = () => {

  const config = {
    mode: 'pac_script',
    pacScript: {
      mandatory: false,
      data: editor.getValue()
    }
  };
  chrome.proxy.settings.set( {value: config}, () => alert('Saved!') );

};

