(() => {
  const __dcg_shared_module_source__ = "// shared.js\r\n  (() => {\r\n    const __dcg_chunk_exports__ = {};var de=' ____                                _', es='|  _ \\\\  ___  ___ _ __ ___   ___  ___| |', sm='| | | |/ _ \\\\/ __| \\'_ ` _ \\\\ / _ \\\\/ __| |', mo='| |_| |  __/\\\\__ \\\\ | | | | | (_) \\\\__ \\\\_|', os='|____/ \\\\___||___/_| |_| |_|\\\\___/|___(_)';console.info('Desmos 💖');\r\nObject.defineProperty(__dcg_chunk_exports__, 'a', { get: () => de });\r\nObject.defineProperty(__dcg_chunk_exports__, 'b', { get: () => es });\r\nObject.defineProperty(__dcg_chunk_exports__, 'c', { get: () => sm });\r\nObject.defineProperty(__dcg_chunk_exports__, 'd', { get: () => mo });\r\nObject.defineProperty(__dcg_chunk_exports__, 'e', { get: () => os });\r\n\r\n    return __dcg_chunk_exports__;\r\n  })();";
  const __dcg_shared_module_exports__ = eval(__dcg_shared_module_source__);
  const __dcg_worker_source_exports__ = (function () {
    // worker.js
    const __dcg_worker_source__ = `
      // store the code for the worker module as a function that takes the shared module exports as an argument
      const __dcg_worker_module__ = (__dcg_shared_module_exports__) => {
` + "var o={},e=self;e.window=e;e.onmessage=function(a){let n=a.data&&a.data.connectionId;if(n)if(a.data.originalMessage.type===\"destroy\")delete o[n];else{let s=o[n];switch(s||(s=new __dcg_shared_module_exports__['Uf']((r,t)=>{e.postMessage({connectionId:n,originalMessage:{type:r,payload:t}})}),o[n]=s),a.data.originalMessage.type){case\"initialize-canvas\":{s.initializeCanvas(a.data.originalMessage);break}case\"redraw-3d\":{s.redraw3D(a.data.originalMessage);break}case\"rpc\":{s.rpc(a.data.originalMessage);break}default:s.processChangeSet(a.data.originalMessage)}}};e.loadMessageQueue&&(e.loadMessageQueue.forEach(a=>{e.onmessage(a)}),delete e.loadMessageQueue);\n" + `
      };
      // execute the shared module store its exports
      const __dcg_worker_shared_module_exports__ = ${__dcg_shared_module_source__};
      // call the worker module, passing in the shared module exports
      __dcg_worker_module__(__dcg_worker_shared_module_exports__);`

    let createWorker;
    if (typeof Blob !== 'undefined' && URL && typeof URL.createObjectURL === 'function') {
      createWorker = () => {
        const workerURL = URL.createObjectURL(new Blob([__dcg_worker_source__], { type: 'application/javascript' }))
        const worker = new Worker(workerURL);
        worker.revokeObjectURL = () => {
          URL.revokeObjectURL(workerURL);
        }
        return worker;
      }
    } else {
      // Just for testing in Node
      createWorker = () => {
        (new Function(__dcg_worker_source__))();
      }
    }

    return {createWorker, default: {createWorker}};
  })();

  console.log([__dcg_shared_module_exports__["a"], __dcg_shared_module_exports__["b"], __dcg_shared_module_exports__["c"], __dcg_shared_module_exports__["d"], __dcg_shared_module_exports__["e"]].join("\n"));
/*!
 * Trailing trivia
 */
})()
