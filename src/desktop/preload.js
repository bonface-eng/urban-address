const { contextBridge, ipcRenderer } = require('electron');

// Securely expose desktop-specific APIs to the Next.js app
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
