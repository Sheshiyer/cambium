const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cambiumDesktop', Object.freeze({
  isDesktop: true,
}));
