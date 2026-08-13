/*
 *   EXPORTS
 ***************************************************************************************************/
export { Drift } from './drift.js'
export { DriftStore } from './store.js'
export { SchemaRegistry } from './registry.js'
export { DriftEventEmitter } from './emitter.js'
export { getInputValue, setInputValue, isEmpty } from './input.js'
export { getInputs, isInDOM, isHidden } from './visibility.js'
export { parseFieldName, setNestedValue, getNestedValue, deleteNestedValue } from './parser.js'

/*
 *   TYPE EXPORTS
 ***************************************************************************************************/
export type { DriftStoreConfig, DriftStoreListener } from './store.js'

export type {
	DriftConfig,
	DriftState,
	DriftFormState,
	DriftSchema,
	DriftFieldSchema,
	ValidationResult,
	ValidationTrigger,
	DriftInputElement,
	DriftSubmitHandler,
	DriftResetHandler,
	DriftStateCallback,
	DriftEventType,
	DriftEvent,
	DriftEventListener,
	DriftFieldMeta,
	DriftFormMeta,
} from './types.js'
