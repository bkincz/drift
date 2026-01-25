/*
 *   IMPORTS
 ***************************************************************************************************/
import { StateMachine } from '@bkincz/clutch'
import { DriftObserver } from './observer'
import { SchemaRegistry } from './registry'
import { setNestedValue, getNestedValue } from './parser'
import type {
	DriftConfig,
	DriftState,
	DriftFormState,
	DriftSchema,
	DriftInputElement,
	DriftSubmitHandler,
	DriftStateCallback,
	DriftEvent,
	DriftEventListener,
} from './types'

/*
 *   INTERNAL CLASSES
 ***************************************************************************************************/
class DriftStateMachine extends StateMachine<DriftState> {}

/*
 *   CONSTANTS
 ***************************************************************************************************/
const DEFAULT_CONFIG: Required<DriftConfig> = {
	formAttribute: 'data-drift-form',
	nestedAttribute: 'data-drift-nested',
	hiddenAttribute: 'data-drift-hidden',
	persist: false,
	observerDebounce: 16,
}

/*
 *   UTILITIES
 ***************************************************************************************************/
function createEmptyFormState(): DriftFormState {
	return {
		values: {},
		errors: {},
		touched: {},
		dirty: {},
		isValid: true,
		isSubmitting: false,
		isValidating: false,
	}
}

function getInputValue(element: DriftInputElement): unknown {
	if (element instanceof HTMLInputElement) {
		switch (element.type) {
			case 'checkbox':
				return element.checked
			case 'number':
			case 'range':
				return element.valueAsNumber
			case 'date':
			case 'datetime-local':
			case 'time':
				return element.value || null
			case 'file':
				return element.files
			default:
				return element.value
		}
	}

	if (element instanceof HTMLSelectElement) {
		if (element.multiple) {
			return Array.from(element.selectedOptions).map(opt => opt.value)
		}
		return element.value
	}

	return element.value
}

function setInputValue(element: DriftInputElement, value: unknown): void {
	if (element instanceof HTMLInputElement) {
		switch (element.type) {
			case 'checkbox':
				element.checked = Boolean(value)
				break
			case 'number':
			case 'range':
				element.value = String(value ?? '')
				break
			case 'radio':
				element.checked = element.value === String(value)
				break
			default:
				element.value = String(value ?? '')
		}
		return
	}

	if (element instanceof HTMLSelectElement) {
		if (element.multiple && Array.isArray(value)) {
			for (const option of element.options) {
				option.selected = value.includes(option.value)
			}
		} else {
			element.value = String(value ?? '')
		}
		return
	}

	element.value = String(value ?? '')
}

function isEmpty(value: unknown): boolean {
	if (value === undefined || value === null || value === '') {
		return true
	}
	if (Array.isArray(value) && value.length === 0) {
		return true
	}
	return false
}

/*
 *   DRIFT CLASS
 ***************************************************************************************************/
/**
 * Main Drift form management class that handles automatic form discovery,
 * state management, validation, and event handling
 */
export class Drift {
	private config: Required<DriftConfig>
	private state: DriftStateMachine
	private observer: DriftObserver
	private registry: SchemaRegistry
	private eventListeners: Map<string, Set<DriftEventListener>> = new Map()
	private fieldElements: Map<string, Map<string, DriftInputElement>> = new Map()
	private formElements: Map<string, HTMLFormElement> = new Map()
	private submitHandlers: Map<string, DriftSubmitHandler> = new Map()
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

	constructor(config: DriftConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config }

		this.state = new DriftStateMachine({
			initialState: { forms: {} },
			enablePersistence: this.config.persist,
			persistenceKey: 'drift-form-state',
		})

		this.registry = new SchemaRegistry()

		this.observer = new DriftObserver(
			{
				onFormAdded: this.handleFormAdded.bind(this),
				onFormRemoved: this.handleFormRemoved.bind(this),
				onFieldsAdded: this.handleFieldsAdded.bind(this),
				onFieldRemoved: this.handleFieldRemoved.bind(this),
			},
			{
				formAttribute: this.config.formAttribute,
				hiddenAttribute: this.config.hiddenAttribute,
				debounceMs: this.config.observerDebounce,
			}
		)
	}

	/**
	 * Start observing the DOM for form elements
	 */
	observe(root: Element = document.body): void {
		this.observer.observe(root)
	}

	/**
	 * Stop observing the DOM and clean up resources
	 */
	disconnect(): void {
		this.observer.disconnect()
		this.clearAllDebounceTimers()
	}

	/**
	 * Register a validation schema for a form
	 */
	registerSchema(formKey: string, schema: DriftSchema): void {
		this.registry.register(formKey, schema)
	}

	/**
	 * Unregister a validation schema for a form
	 */
	unregisterSchema(formKey: string): void {
		this.registry.unregister(formKey)
	}

	/**
	 * Get the current state of a form
	 */
	getForm(formKey: string): DriftFormState | undefined {
		return this.state.getState().forms[formKey]
	}

	/**
	 * Get all form states
	 */
	getAllForms(): Record<string, DriftFormState> {
		return this.state.getState().forms
	}

	/**
	 * Get a field value from a form
	 */
	getValue(formKey: string, fieldName: string): unknown {
		const form = this.getForm(formKey)
		if (!form) return undefined
		return getNestedValue(form.values, fieldName)
	}

	/**
	 * Set a field value in a form
	 */
	setValue(formKey: string, fieldName: string, value: unknown): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			draft.forms[formKey].values = setNestedValue(
				draft.forms[formKey].values,
				fieldName,
				value
			) as Record<string, unknown>
			draft.forms[formKey].dirty[fieldName] = true
		})

		const element = this.fieldElements.get(formKey)?.get(fieldName)
		if (element) {
			setInputValue(element, value)
		}

		this.emitEvent({ type: 'field:change', formKey, fieldName, value })
	}

	/**
	 * Set multiple field values in a form
	 */
	setValues(formKey: string, values: Record<string, unknown>): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			for (const [fieldName, value] of Object.entries(values)) {
				draft.forms[formKey].values = setNestedValue(
					draft.forms[formKey].values,
					fieldName,
					value
				) as Record<string, unknown>
				draft.forms[formKey].dirty[fieldName] = true
			}
		})

		for (const [fieldName, value] of Object.entries(values)) {
			const element = this.fieldElements.get(formKey)?.get(fieldName)
			if (element) {
				setInputValue(element, value)
			}
		}
	}

	/**
	 * Get validation errors for a specific field
	 */
	getErrors(formKey: string, fieldName: string): string[] {
		const form = this.getForm(formKey)
		return form?.errors[fieldName] ?? []
	}

	/**
	 * Get all validation errors for a form
	 */
	getAllErrors(formKey: string): Record<string, string[]> {
		const form = this.getForm(formKey)
		return form?.errors ?? {}
	}

	/**
	 * Clear validation errors for a form or specific field
	 */
	clearErrors(formKey: string, fieldName?: string): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			if (fieldName) {
				delete draft.forms[formKey].errors[fieldName]
			} else {
				draft.forms[formKey].errors = {}
			}

			draft.forms[formKey].isValid = Object.keys(draft.forms[formKey].errors).length === 0
		})
	}

	/**
	 * Set validation errors for a form
	 */
	setErrors(formKey: string, errors: Record<string, string[]>): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			draft.forms[formKey].errors = { ...draft.forms[formKey].errors, ...errors }
			draft.forms[formKey].isValid = Object.keys(draft.forms[formKey].errors).length === 0
		})
	}

	/**
	 * Check if a field has been touched
	 */
	isTouched(formKey: string, fieldName: string): boolean {
		const form = this.getForm(formKey)
		return form?.touched[fieldName] ?? false
	}

	/**
	 * Check if a field has been modified
	 */
	isDirty(formKey: string, fieldName: string): boolean {
		const form = this.getForm(formKey)
		return form?.dirty[fieldName] ?? false
	}

	/**
	 * Check if any field in a form has been modified
	 */
	isFormDirty(formKey: string): boolean {
		const form = this.getForm(formKey)
		if (!form) return false
		return Object.values(form.dirty).some(Boolean)
	}

	/**
	 * Reset a form to its initial state
	 */
	resetForm(formKey: string): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			draft.forms[formKey] = createEmptyFormState()
		})

		const fields = this.fieldElements.get(formKey)
		if (fields) {
			for (const element of fields.values()) {
				setInputValue(element, '')
			}
		}
	}

	/**
	 * Validate a specific field
	 */
	async validateField(formKey: string, fieldName: string): Promise<boolean> {
		const form = this.getForm(formKey)
		if (!form) return true

		const value = getNestedValue(form.values, fieldName)

		this.emitEvent({ type: 'validation:start', formKey, fieldName })

		const result = await this.registry.validateField(formKey, fieldName, value, form.values)

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			if (result.success) {
				delete draft.forms[formKey].errors[fieldName]
			} else if (result.errors) {
				const fieldErrors = result.errors[fieldName]
				if (fieldErrors) {
					draft.forms[formKey].errors[fieldName] = fieldErrors
				}
			}

			draft.forms[formKey].isValid = Object.keys(draft.forms[formKey].errors).length === 0
		})

		this.emitEvent({
			type: 'validation:end',
			formKey,
			fieldName,
			errors: result.errors?.[fieldName],
		})

		return result.success
	}

	/**
	 * Validate an entire form
	 */
	async validateForm(formKey: string): Promise<boolean> {
		const form = this.getForm(formKey)
		if (!form) return true

		this.state.mutate(draft => {
			if (draft.forms[formKey]) {
				draft.forms[formKey].isValidating = true
			}
		})

		this.emitEvent({ type: 'validation:start', formKey })

		// Run form-level validation
		const result = await this.registry.validateForm(formKey, form.values)

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			if (result.success) {
				draft.forms[formKey].errors = {}
			} else if (result.errors) {
				draft.forms[formKey].errors = result.errors
			}

			draft.forms[formKey].isValid = Object.keys(draft.forms[formKey].errors).length === 0
			draft.forms[formKey].isValidating = false
		})

		this.emitEvent({ type: 'validation:end', formKey })

		return result.success
	}

	/**
	 * Register a submit handler for a form
	 */
	onSubmit(formKey: string, handler: DriftSubmitHandler): () => void {
		this.submitHandlers.set(formKey, handler)
		return () => this.submitHandlers.delete(formKey)
	}

	/**
	 * Submit a form programmatically
	 */
	async submit(formKey: string): Promise<boolean> {
		const form = this.getForm(formKey)
		if (!form) return false

		this.state.mutate(draft => {
			if (draft.forms[formKey]) {
				draft.forms[formKey].isSubmitting = true
			}
		})

		this.emitEvent({ type: 'submit:start', formKey })

		const isValid = await this.validateForm(formKey)

		if (!isValid) {
			this.state.mutate(draft => {
				if (draft.forms[formKey]) {
					draft.forms[formKey].isSubmitting = false
				}
			})
			this.emitEvent({ type: 'submit:end', formKey })
			return false
		}

		const handler = this.submitHandlers.get(formKey)
		if (handler) {
			try {
				await handler(form.values, formKey)
			} catch (error) {
				console.error(`[Drift] Submit handler error for form "${formKey}":`, error)
			}
		}

		this.state.mutate(draft => {
			if (draft.forms[formKey]) {
				draft.forms[formKey].isSubmitting = false
			}
		})

		this.emitEvent({ type: 'submit:end', formKey })

		return true
	}

	/**
	 * Subscribe to state changes for a specific form
	 */
	subscribe(formKey: string, callback: DriftStateCallback): () => void {
		return this.state.subscribe(state => {
			const form = state.forms[formKey]
			if (form) {
				callback(form)
			}
		})
	}

	/**
	 * Subscribe to state changes for all forms
	 */
	subscribeAll(callback: (forms: Record<string, DriftFormState>) => void): () => void {
		return this.state.subscribe(state => {
			callback(state.forms)
		})
	}

	/**
	 * Add an event listener
	 */
	on(event: string, listener: DriftEventListener): () => void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set())
		}
		this.eventListeners.get(event)!.add(listener)
		return () => this.eventListeners.get(event)?.delete(listener)
	}

	/**
	 * Remove an event listener
	 */
	off(event: string, listener: DriftEventListener): void {
		this.eventListeners.get(event)?.delete(listener)
	}

	/*
	 *   PRIVATE METHODS
	 ************************************************************************************************/
	private handleFormAdded(form: HTMLFormElement, formKey: string): void {
		this.formElements.set(formKey, form)
		this.fieldElements.set(formKey, new Map())

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) {
				draft.forms[formKey] = createEmptyFormState()
			}
		})

		form.addEventListener('submit', e => {
			e.preventDefault()
			this.submit(formKey)
		})

		this.emitEvent({ type: 'form:register', formKey })
	}

	private handleFormRemoved(_form: HTMLFormElement, formKey: string): void {
		this.formElements.delete(formKey)
		this.fieldElements.delete(formKey)
		this.clearDebounceTimersForForm(formKey)
		this.emitEvent({ type: 'form:unregister', formKey })
	}

	private handleFieldsAdded(
		fields: DriftInputElement[],
		_form: HTMLFormElement,
		formKey: string
	): void {
		const fieldMap = this.fieldElements.get(formKey)
		if (!fieldMap) return

		const fieldData: Array<{ field: DriftInputElement; name: string; value: unknown }> = []

		for (const field of fields) {
			if (!field.name) continue
			fieldMap.set(field.name, field)
			fieldData.push({
				field,
				name: field.name,
				value: getInputValue(field),
			})
		}

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			for (const { field, name, value } of fieldData) {
				const existingValue = getNestedValue(draft.forms[formKey].values, name)

				if (isEmpty(existingValue) && !isEmpty(value)) {
					draft.forms[formKey].values = setNestedValue(
						draft.forms[formKey].values,
						name,
						value
					) as Record<string, unknown>
				} else if (!isEmpty(existingValue)) {
					setInputValue(field, existingValue)
				}
			}
		})

		for (const { field, name, value } of fieldData) {
			this.attachFieldListeners(field, formKey, name)
			this.emitEvent({ type: 'field:register', formKey, fieldName: name, value })
		}
	}

	private handleFieldRemoved(
		field: DriftInputElement,
		_form: HTMLFormElement,
		formKey: string
	): void {
		const fieldName = field.name
		if (fieldName) {
			this.emitEvent({ type: 'field:unregister', formKey, fieldName })
		}
	}

	private attachFieldListeners(
		field: DriftInputElement,
		formKey: string,
		fieldName: string
	): void {
		const handleChange = () => {
			const value = getInputValue(field)

			this.state.mutate(draft => {
				if (!draft.forms[formKey]) return

				draft.forms[formKey].values = setNestedValue(
					draft.forms[formKey].values,
					fieldName,
					value
				) as Record<string, unknown>
				draft.forms[formKey].dirty[fieldName] = true
			})

			this.emitEvent({ type: 'field:change', formKey, fieldName, value })
			this.triggerFieldValidation(formKey, fieldName, 'change')
		}

		const handleBlur = () => {
			this.state.mutate(draft => {
				if (!draft.forms[formKey]) return
				draft.forms[formKey].touched[fieldName] = true
			})

			this.emitEvent({ type: 'field:blur', formKey, fieldName })
			this.triggerFieldValidation(formKey, fieldName, 'blur')
		}

		const handleFocus = () => {
			this.emitEvent({ type: 'field:focus', formKey, fieldName })
		}

		if (field instanceof HTMLSelectElement) {
			field.addEventListener('change', handleChange)
		} else {
			field.addEventListener('input', handleChange)
		}

		field.addEventListener('blur', handleBlur)
		field.addEventListener('focus', handleFocus)
	}

	private triggerFieldValidation(
		formKey: string,
		fieldName: string,
		eventType: 'change' | 'blur'
	): void {
		const fieldSchema = this.registry.getFieldSchema(formKey, fieldName)
		if (!fieldSchema) return

		const trigger = fieldSchema.validateOn

		if (trigger === eventType) {
			this.validateField(formKey, fieldName)
		} else if (typeof trigger === 'object' && 'debounce' in trigger && eventType === 'change') {
			this.debouncedValidation(formKey, fieldName, trigger.debounce)
		}
	}

	private debouncedValidation(formKey: string, fieldName: string, delayMs: number): void {
		const key = `${formKey}:${fieldName}`

		const existingTimer = this.debounceTimers.get(key)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		const timer = setTimeout(() => {
			this.debounceTimers.delete(key)
			this.validateField(formKey, fieldName)
		}, delayMs)

		this.debounceTimers.set(key, timer)
	}

	private clearDebounceTimersForForm(formKey: string): void {
		for (const [key, timer] of this.debounceTimers) {
			if (key.startsWith(`${formKey}:`)) {
				clearTimeout(timer)
				this.debounceTimers.delete(key)
			}
		}
	}

	private clearAllDebounceTimers(): void {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer)
		}
		this.debounceTimers.clear()
	}

	private emitEvent(event: DriftEvent): void {
		const listeners = this.eventListeners.get(event.type)
		if (listeners) {
			for (const listener of listeners) {
				listener(event)
			}
		}

		const wildcardListeners = this.eventListeners.get('*')
		if (wildcardListeners) {
			for (const listener of wildcardListeners) {
				listener(event)
			}
		}
	}
}
