/*
 *   IMPORTS
 ***************************************************************************************************/
import { StateMachine } from '@bkincz/clutch'
import { DriftObserver } from './observer'
import { SchemaRegistry } from './registry'
import { DriftEventEmitter } from './emitter'
import { getInputValue, setInputValue, isEmpty } from './input'
import { setNestedValue, getNestedValue } from './parser'
import type {
	DriftConfig,
	DriftState,
	DriftFormState,
	DriftSchema,
	DriftInputElement,
	DriftSubmitHandler,
	DriftResetHandler,
	DriftStateCallback,
	DriftEvent,
	DriftEventListener,
	ValidationTrigger,
} from './types'

/*
 *   INTERNAL CLASSES
 ***************************************************************************************************/
class DriftStateMachine extends StateMachine<DriftState> {}

/*
 *   CONSTANTS
 ***************************************************************************************************/
const DEFAULT_CONFIG: Required<Omit<DriftConfig, 'defaultValidateOn'>> & {
	defaultValidateOn?: ValidationTrigger
} = {
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
		initialValues: {},
		hasBeenValidated: false,
		canSubmit: false,
		validatingFields: {},
	}
}

/*
 *   DRIFT CLASS
 ***************************************************************************************************/
/**
 * Main Drift form management class that handles automatic form discovery,
 * state management, validation, and event handling
 */
export class Drift {
	private config: Required<Omit<DriftConfig, 'defaultValidateOn'>> & {
		defaultValidateOn?: ValidationTrigger
	}
	private state: DriftStateMachine
	private observer: DriftObserver
	private registry: SchemaRegistry
	private emitter: DriftEventEmitter = new DriftEventEmitter()
	private fieldElements: Map<string, Map<string, DriftInputElement>> = new Map()
	private formElements: Map<string, HTMLFormElement> = new Map()
	private submitHandlers: Map<string, DriftSubmitHandler> = new Map()
	private resetHandlers: Map<string, DriftResetHandler> = new Map()
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
	private suppressedElements: Set<DriftInputElement> = new Set()
	private radioGroups: Map<string, Map<string, Set<HTMLInputElement>>> = new Map()

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
			this.setInputValueInternal(element, value, formKey)
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
				this.setInputValueInternal(element, value, formKey)
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
			draft.forms[formKey].canSubmit =
				draft.forms[formKey].hasBeenValidated && draft.forms[formKey].isValid
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
			draft.forms[formKey].canSubmit =
				draft.forms[formKey].hasBeenValidated && draft.forms[formKey].isValid
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
	 * Set initial values for a form
	 */
	setInitialValues(formKey: string, values: Record<string, unknown>): void {
		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			draft.forms[formKey].initialValues = { ...values }

			for (const [fieldName, value] of Object.entries(values)) {
				draft.forms[formKey].values = setNestedValue(
					draft.forms[formKey].values,
					fieldName,
					value
				) as Record<string, unknown>
				delete draft.forms[formKey].dirty[fieldName]
			}
		})

		const fields = this.fieldElements.get(formKey)
		if (fields) {
			for (const [fieldName, value] of Object.entries(values)) {
				const element = fields.get(fieldName)
				if (element) {
					this.setInputValueInternal(element, value, formKey)
				}
			}
		}
	}

	/**
	 * Reset a form to its initial state
	 */
	async resetForm(formKey: string): Promise<void> {
		const form = this.getForm(formKey)
		if (!form) return

		const initialValues = { ...form.initialValues }

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			const empty = createEmptyFormState()
			draft.forms[formKey].values = { ...initialValues }
			draft.forms[formKey].errors = empty.errors
			draft.forms[formKey].touched = empty.touched
			draft.forms[formKey].dirty = empty.dirty
			draft.forms[formKey].isValid = empty.isValid
			draft.forms[formKey].isSubmitting = empty.isSubmitting
			draft.forms[formKey].isValidating = empty.isValidating
			draft.forms[formKey].hasBeenValidated = empty.hasBeenValidated
			draft.forms[formKey].canSubmit = empty.canSubmit
			draft.forms[formKey].validatingFields = empty.validatingFields
			draft.forms[formKey].initialValues = initialValues
		})

		const fields = this.fieldElements.get(formKey)
		if (fields) {
			for (const [fieldName, element] of fields.entries()) {
				const value = initialValues[fieldName] ?? ''
				this.setInputValueInternal(element, value, formKey)
			}
		}

		const resetHandler = this.resetHandlers.get(formKey)
		if (resetHandler) {
			try {
				await resetHandler()
			} catch (error) {
				console.error(`[Drift] Reset handler error for form "${formKey}":`, error)
			}
		}

		this.emitEvent({ type: 'form:reset', formKey })
	}

	/**
	 * Validate a specific field
	 */
	async validateField(formKey: string, fieldName: string): Promise<boolean> {
		const form = this.getForm(formKey)
		if (!form) return true

		const value = getNestedValue(form.values, fieldName)

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return
			draft.forms[formKey].validatingFields[fieldName] = true
		})

		this.emitEvent({ type: 'validation:start', formKey, fieldName })
		const result = await this.registry.validateField(formKey, fieldName, value, form.values)

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			if (result.success) {
				delete draft.forms[formKey].errors[fieldName]
			} else if (result.errors) {
				for (const [key, errs] of Object.entries(result.errors)) {
					if (errs?.length) draft.forms[formKey].errors[key] = errs
				}
			}

			draft.forms[formKey].isValid = Object.keys(draft.forms[formKey].errors).length === 0
			draft.forms[formKey].canSubmit =
				draft.forms[formKey].hasBeenValidated && draft.forms[formKey].isValid
			draft.forms[formKey].validatingFields[fieldName] = false
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
			draft.forms[formKey].hasBeenValidated = true
			draft.forms[formKey].canSubmit = draft.forms[formKey].isValid
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
	 * Register a reset handler for a form
	 */
	onReset(formKey: string, handler: DriftResetHandler): () => void {
		this.resetHandlers.set(formKey, handler)
		return () => this.resetHandlers.delete(formKey)
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
		return this.emitter.on(event, listener)
	}

	/**
	 * Remove an event listener
	 */
	off(event: string, listener: DriftEventListener): void {
		this.emitter.off(event, listener)
	}

	/*
	 *   PRIVATE METHODS
	 ************************************************************************************************/
	private handleFormAdded(form: HTMLFormElement, formKey: string): void {
		this.formElements.set(formKey, form)
		this.fieldElements.set(formKey, new Map())
		this.radioGroups.set(formKey, new Map())

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) {
				draft.forms[formKey] = createEmptyFormState()
			}
		})

		form.addEventListener('submit', e => {
			e.preventDefault()
			this.submit(formKey)
		})

		form.addEventListener('reset', e => {
			e.preventDefault()
			this.resetForm(formKey)
		})

		this.emitEvent({ type: 'form:register', formKey })
	}

	private handleFormRemoved(_form: HTMLFormElement, formKey: string): void {
		this.formElements.delete(formKey)
		this.fieldElements.delete(formKey)
		this.radioGroups.delete(formKey)
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

		for (const field of fields) {
			if (!field.name) continue

			if (field instanceof HTMLInputElement && field.type === 'radio') {
				const formRadioGroups = this.radioGroups.get(formKey)
				if (formRadioGroups) {
					if (!formRadioGroups.has(field.name)) {
						formRadioGroups.set(field.name, new Set())
					}
					formRadioGroups.get(field.name)!.add(field)
				}
				if (!fieldMap.has(field.name)) {
					fieldMap.set(field.name, field)
				}
			} else {
				fieldMap.set(field.name, field)
			}
		}

		const fieldData: Array<{ field: DriftInputElement; name: string; value: unknown }> = []
		const processedNames = new Set<string>()

		for (const field of fields) {
			if (!field.name) continue
			if (processedNames.has(field.name)) continue
			processedNames.add(field.name)

			let value: unknown
			if (field instanceof HTMLInputElement && field.type === 'radio') {
				const group = this.radioGroups.get(formKey)?.get(field.name)
				value = group ? (Array.from(group).find(el => el.checked)?.value ?? null) : null
			} else {
				value = getInputValue(field)
			}

			fieldData.push({ field, name: field.name, value })
		}

		this.state.mutate(draft => {
			if (!draft.forms[formKey]) return

			for (const { name, value } of fieldData) {
				const existingValue = getNestedValue(draft.forms[formKey].values, name)

				if (isEmpty(existingValue) && !isEmpty(value)) {
					draft.forms[formKey].values = setNestedValue(
						draft.forms[formKey].values,
						name,
						value
					) as Record<string, unknown>
				} else if (!isEmpty(existingValue)) {
					const el = fieldMap.get(name)
					const isRadio = el instanceof HTMLInputElement && el.type === 'radio'
					if (isRadio) {
						const group = this.radioGroups.get(formKey)?.get(name)
						if (group) {
							for (const radioEl of group) {
								this.setInputValueInternal(radioEl, existingValue, formKey)
							}
						}
					} else if (el) {
						this.setInputValueInternal(el, existingValue, formKey)
					}
				}
			}
		})

		for (const field of fields) {
			if (!field.name) continue
			this.attachFieldListeners(field, formKey, field.name)
		}

		for (const { name, value } of fieldData) {
			this.emitEvent({ type: 'field:register', formKey, fieldName: name, value })
		}
	}

	private handleFieldRemoved(
		field: DriftInputElement,
		_form: HTMLFormElement,
		formKey: string
	): void {
		const fieldName = field.name

		if (field instanceof HTMLInputElement && field.type === 'radio') {
			const group = this.radioGroups.get(formKey)?.get(fieldName)
			if (group) {
				group.delete(field)
				if (group.size === 0) {
					this.radioGroups.get(formKey)?.delete(fieldName)
					if (this.radioGroups.get(formKey)?.size === 0) {
						this.radioGroups.delete(formKey)
					}
				}
			}
		}

		if (fieldName) {
			this.emitEvent({ type: 'field:unregister', formKey, fieldName })
		}
	}

	private attachFieldListeners(
		field: DriftInputElement,
		formKey: string,
		fieldName: string
	): void {
		const isRadio = field instanceof HTMLInputElement && field.type === 'radio'

		const handleChange = () => {
			if (this.suppressedElements.has(field)) return

			let value: unknown
			if (isRadio) {
				const group = this.radioGroups.get(formKey)?.get(fieldName)
				value = group
					? (Array.from(group).find(el => el.checked)?.value ?? null)
					: getInputValue(field)
			} else {
				value = getInputValue(field)
			}

			const fieldSchema = this.registry.getFieldSchema(formKey, fieldName)
			if (fieldSchema?.transform) {
				value = fieldSchema.transform(value)
			}

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

		if (isRadio || field instanceof HTMLSelectElement) {
			field.addEventListener('change', handleChange)
		} else {
			field.addEventListener('input', handleChange)
		}

		field.addEventListener('blur', handleBlur)
		field.addEventListener('focus', handleFocus)

		this.watchForProgrammaticChanges(field)
	}

	private triggerFieldValidation(
		formKey: string,
		fieldName: string,
		eventType: 'change' | 'blur'
	): void {
		const fieldSchema = this.registry.getFieldSchema(formKey, fieldName)
		const trigger = fieldSchema?.validateOn ?? this.config.defaultValidateOn
		const hasErrors = (this.getForm(formKey)?.errors[fieldName]?.length ?? 0) > 0

		if (trigger === undefined && !hasErrors) return

		if (trigger === eventType || hasErrors) {
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

	private setInputValueInternal(
		element: DriftInputElement,
		value: unknown,
		formKey?: string
	): void {
		if (formKey && element instanceof HTMLInputElement && element.type === 'radio') {
			const group = this.radioGroups.get(formKey)?.get(element.name)
			if (group) {
				for (const el of group) {
					this.suppressedElements.add(el)
					el.checked = el.value === String(value ?? '')
					this.suppressedElements.delete(el)
				}
				return
			}
		}

		this.suppressedElements.add(element)
		setInputValue(element, value)
		this.suppressedElements.delete(element)
	}

	private watchForProgrammaticChanges(field: DriftInputElement): void {
		const isCheckable =
			field instanceof HTMLInputElement &&
			(field.type === 'checkbox' || field.type === 'radio')
		const prop = isCheckable ? 'checked' : 'value'

		const proto = Object.getPrototypeOf(field)
		const descriptor = Object.getOwnPropertyDescriptor(proto, prop)
		if (!descriptor?.set || !descriptor?.get) return

		const nativeGet = descriptor.get
		const nativeSet = descriptor.set

		Object.defineProperty(field, prop, {
			get: () => nativeGet.call(field),
			set: (newValue: unknown) => {
				const oldValue = nativeGet.call(field)
				nativeSet.call(field, newValue)
				if (oldValue !== newValue && !this.suppressedElements.has(field)) {
					field.dispatchEvent(
						new Event(isCheckable ? 'change' : 'input', { bubbles: true })
					)
				}
			},
			configurable: true,
		})
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
		this.emitter.emit(event)
	}
}
