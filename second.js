
    (() => {
      var __webpack_modules__ = {
        
            './example/src/module.js': (module) => {
              // webpack/example/module.js
const name = 'xeq';
module.exports = {
  name
};
const loader2 = 'xeq loader2';
const loader1 = 'xeq loader1';
        }
          
      };
      // The module cache
      var __webpack_module_cache__ = {};
  
      // The require function
      function __webpack_require__(moduleId) {
        // Check if module is in cache
        var cachedModule = __webpack_module_cache__[moduleId];
        if (cachedModule !== undefined) {
          return cachedModule.exports;
        }
        // Create a new module (and put it into the cache)
        var module = (__webpack_module_cache__[moduleId] = {
          // no module.id needed
          // no module.loaded needed
          exports: {},
        });
  
        // Execute the module function
        __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  
        // Return the exports of the module
        return module.exports;
      }
  
      var __webpack_exports__ = {};
      // This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
      (() => {
        // webpack/example/entry2.js
const depModule = __webpack_require__("./example/src/module.js");
console.log(depModule, 'dep');
console.log('This is entry 2 !');
const loader2 = 'xeq loader2';
const loader1 = 'xeq loader1';
      })();
    })();
    