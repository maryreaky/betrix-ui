/* CANONICAL EXPORT GUARD: ensure handleCommand exists during circular loads */
let handleCommand;
/* REPLACED INLINE EXPORT: use Object.assign to avoid overwriting */
    // Available immediately even if file hasn't finished loading
    return { ok:false, error:'HANDLE_NOT_READY' };
  }
};
/* END EXPORT GUARD */
/* RECOVERY STUB: temporary minimal handleCommand so module loads.
   Replace with your real implementation inside menu-handler.impl.js when ready. */
async function handleCommand(env, jobOrUpdate) {
  try {
    console.error(new Date().toISOString(), 'RECOVERY_STUB_USED');
    return { ok:false, error:'RECOVERY_STUB_USED' };
  } catch(e) {
    return { ok:false, error: (e && (e.message||String(e))) };
  }
}
// Shim menu-handler.js — imports implementation and re-exports handleCommand.
// This shim must be side-effect free at require time to avoid circular self-require.
try {
  const impl = require('./menu-handler.impl.js');
  if (impl && typeof impl.handleCommand === 'function') {
/* REPLACED INLINE EXPORT: use Object.assign to avoid overwriting */
  } else {
    // fallback shim: export a safe function
    module.exports = {
      handleCommand: async function(env, jobOrUpdate) {
        console.error(new Date().toISOString(), 'MENU_HANDLER_IMPL_MISSING', { hasImpl: !!impl });
        return { ok:false, error:'menu-handler implementation missing' };
      }
    };
  }
} catch (e) {
  // If impl failed to load (syntax error), export safe fallback to avoid throwing at require
/* REPLACED INLINE EXPORT: use Object.assign to avoid overwriting */
    }
  };
}

//// CANONICAL FOOTER (do not overwrite module.exports)
try {
  // If this file declares 'function handleCommand(...)' above, the guard now points to it.
  // If it declares a different name (e.g., realHandleCommand), bind it here.
  // Example binding (uncomment and adjust if using a different name):
  // handleCommand = realHandleCommand;

  // Ensure module.exports keeps handleCommand without overwrite
  Object.assign(module.exports, { handleCommand });
} catch (e) {
  // Keep module stable even on footer errors
  console.error(new Date().toISOString(), 'MENU_HANDLER_FOOTER_ERR', e && (e.stack || e.message));
}

