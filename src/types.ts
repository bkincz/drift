/*
 *   VALIDATION TYPES
 ***************************************************************************************************/
export interface ValidationResult {
	success: boolean
	errors?: Record<string, string[]>
}

export type ValidationTrigger = 'blur' | 'change' | { debounce: number }

/*
 *   SCHEMA TYPES
 ***************************************************************************************************/
export interface DriftFieldSchema {
	validate: (
		value: unknown,
		allValues: Record<string, unknown>
	) => ValidationResult | Promise<ValidationResult>
	validateOn?: ValidationTrigger
	transform?: (value: unknown) => unknown
}

export interface DriftSchema {
	validate?: (values: Record<string, unknown>) => ValidationResult | Promise<ValidationResult>
	fields?: Record<string, DriftFieldSchema>
}

/*
 *   STATE TYPES
 ***************************************************************************************************/
export interface DriftFormState {
	values: Record<string, unknown>
	errors: Record<string, string[]>
	touched: Record<string, boolean>
	dirty: Record<string, boolean>
	isValid: boolean
	isSubmitting: boolean
	isValidating: boolean
	initialValues: Record<string, unknown>
	hasBeenValidated: boolean
	canSubmit: boolean
	validatingFields: Record<string, boolean>
}

export interface DriftState {
	forms: Record<string, DriftFormState>
}

/*
 *   CONFIG TYPES
 ***************************************************************************************************/
export interface DriftConfig {
	formAttribute?: string
	nestedAttribute?: string
	hiddenAttribute?: string
	persist?: boolean
	observerDebounce?: number
	defaultValidateOn?: ValidationTrigger
}

/*
 *   ELEMENT TYPES
 ***************************************************************************************************/
export type DriftInputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/*
 *   HANDLER TYPES
 ***************************************************************************************************/
export type DriftSubmitHandler = (
	values: Record<string, unknown>,
	formKey: string
) => void | Promise<void>

export type DriftResetHandler = () => void | Promise<void>

export type DriftStateCallback = (state: DriftFormState) => void

/*
 *   METADATA TYPES
 ***************************************************************************************************/
export interface DriftFieldMeta {
	element: DriftInputElement
	formKey: string
	fieldName: string
	initialValue: unknown
	debounceTimer?: ReturnType<typeof setTimeout>
}

export interface DriftFormMeta {
	element: Element
	formKey: string
	fields: Map<string, DriftFieldMeta>
	submitHandler?: DriftSubmitHandler
}

/*
 *   EVENT TYPES
 ***************************************************************************************************/
export type DriftEventType =
	| 'form:register'
	| 'form:unregister'
	| 'form:reset'
	| 'field:register'
	| 'field:unregister'
	| 'field:change'
	| 'field:blur'
	| 'field:focus'
	| 'validation:start'
	| 'validation:end'
	| 'submit:start'
	| 'submit:end'

export interface DriftEvent {
	type: DriftEventType
	formKey: string
	fieldName?: string
	value?: unknown
	errors?: string[]
}

export type DriftEventListener = (event: DriftEvent) => void
