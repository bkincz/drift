/*
 *   IMPORTS
 ***************************************************************************************************/
import type { DriftInputElement } from './types'
import { getInputs, isHidden } from './visibility'

/*
 *   TYPES
 ***************************************************************************************************/
export interface DriftObserverCallbacks {
	onFormAdded: (form: HTMLFormElement, formKey: string) => void
	onFormRemoved: (form: HTMLFormElement, formKey: string) => void
	onFieldsAdded: (fields: DriftInputElement[], form: HTMLFormElement, formKey: string) => void
	onFieldRemoved: (field: DriftInputElement, form: HTMLFormElement, formKey: string) => void
}

export interface DriftObserverConfig {
	formAttribute: string
	hiddenAttribute: string
	debounceMs: number
}

/*
 *   DRIFT OBSERVER CLASS
 ***************************************************************************************************/
/**
 * MutationObserver-based class that watches for form and field changes in the DOM
 */
export class DriftObserver {
	private observer: MutationObserver | null = null
	private root: Element | null = null
	private callbacks: DriftObserverCallbacks
	private config: DriftObserverConfig
	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private pendingMutations: MutationRecord[] = []

	private trackedForms: Map<HTMLFormElement, string> = new Map()
	private trackedFields: Map<DriftInputElement, { form: HTMLFormElement; formKey: string }> =
		new Map()

	constructor(callbacks: DriftObserverCallbacks, config: DriftObserverConfig) {
		this.callbacks = callbacks
		this.config = config
	}

	/**
	 * Start observing a root element for form changes
	 */
	observe(root: Element): void {
		if (this.observer) {
			this.disconnect()
		}

		this.root = root

		this.observer = new MutationObserver(mutations => {
			this.pendingMutations.push(...mutations)
			this.scheduleMutationProcessing()
		})

		this.observer.observe(root, {
			childList: true,
			subtree: true,
		})

		this.scanForForms(root)
	}

	/**
	 * Stop observing and clean up resources
	 */
	disconnect(): void {
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}

		this.pendingMutations = []
		this.trackedForms.clear()
		this.trackedFields.clear()
		this.root = null
	}

	/**
	 * Manually trigger a rescan of the observed root element
	 */
	rescan(): void {
		if (this.root) {
			this.scanForForms(this.root)
		}
	}

	/*
	 *   PRIVATE METHODS
	 ************************************************************************************************/
	private scheduleMutationProcessing(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}

		this.debounceTimer = setTimeout(() => {
			this.processMutations()
		}, this.config.debounceMs)
	}

	private processMutations(): void {
		const mutations = this.pendingMutations
		this.pendingMutations = []

		const addedNodes = new Set<Node>()
		const removedNodes = new Set<Node>()

		for (const mutation of mutations) {
			mutation.addedNodes.forEach(node => addedNodes.add(node))
			mutation.removedNodes.forEach(node => removedNodes.add(node))
		}

		for (const node of removedNodes) {
			if (!addedNodes.has(node)) {
				this.handleNodeRemoved(node)
			}
		}

		for (const node of addedNodes) {
			if (!removedNodes.has(node)) {
				this.handleNodeAdded(node)
			}
		}
	}

	private handleNodeAdded(node: Node): void {
		if (!(node instanceof Element)) {
			return
		}

		if (node instanceof HTMLFormElement) {
			const formKey = node.getAttribute(this.config.formAttribute)
			if (formKey) {
				this.registerForm(node, formKey)
			}
		}

		if (this.isInputElement(node)) {
			const form = this.findParentForm(node)
			if (form && node.name && !isHidden(node, this.config.hiddenAttribute)) {
				const formKey = this.trackedForms.get(form)
				if (formKey) {
					this.registerField(node, form, formKey)
				}
			}
		}

		this.scanForForms(node)
	}

	private handleNodeRemoved(node: Node): void {
		if (!(node instanceof Element)) {
			return
		}

		if (node instanceof HTMLFormElement && this.trackedForms.has(node)) {
			const formKey = this.trackedForms.get(node)!
			this.unregisterForm(node, formKey)
		}

		if (this.isInputElement(node) && this.trackedFields.has(node)) {
			const { form, formKey } = this.trackedFields.get(node)!
			this.unregisterField(node, form, formKey)
		}

		this.scanRemovedNode(node)
	}

	private scanForForms(root: Element): void {
		if (root instanceof HTMLFormElement && root.hasAttribute(this.config.formAttribute)) {
			const formKey = root.getAttribute(this.config.formAttribute)!
			if (!this.trackedForms.has(root)) {
				this.registerForm(root, formKey)
			}
		}

		const forms = root.querySelectorAll<HTMLFormElement>(`form[${this.config.formAttribute}]`)

		for (const form of forms) {
			const formKey = form.getAttribute(this.config.formAttribute)!
			if (!this.trackedForms.has(form)) {
				this.registerForm(form, formKey)
			}
		}
	}

	private scanRemovedNode(node: Element): void {
		const forms = node.querySelectorAll<HTMLFormElement>(`form[${this.config.formAttribute}]`)

		for (const form of forms) {
			if (this.trackedForms.has(form)) {
				const formKey = this.trackedForms.get(form)!
				this.unregisterForm(form, formKey)
			}
		}

		const inputs = node.querySelectorAll<DriftInputElement>('input, textarea, select')
		for (const input of inputs) {
			if (this.trackedFields.has(input)) {
				const { form, formKey } = this.trackedFields.get(input)!
				this.unregisterField(input, form, formKey)
			}
		}
	}

	private registerForm(form: HTMLFormElement, formKey: string): void {
		this.trackedForms.set(form, formKey)
		this.callbacks.onFormAdded(form, formKey)

		const inputs = getInputs(form, this.config.hiddenAttribute)
		const newFields: DriftInputElement[] = []

		for (const input of inputs) {
			if (!this.trackedFields.has(input)) {
				this.trackedFields.set(input, { form, formKey })
				newFields.push(input)
			}
		}

		if (newFields.length > 0) {
			this.callbacks.onFieldsAdded(newFields, form, formKey)
		}
	}

	private unregisterForm(form: HTMLFormElement, formKey: string): void {
		for (const [field, data] of this.trackedFields) {
			if (data.form === form) {
				this.trackedFields.delete(field)
				this.callbacks.onFieldRemoved(field, form, formKey)
			}
		}

		this.trackedForms.delete(form)
		this.callbacks.onFormRemoved(form, formKey)
	}

	private registerField(field: DriftInputElement, form: HTMLFormElement, formKey: string): void {
		if (this.trackedFields.has(field)) {
			return
		}

		this.trackedFields.set(field, { form, formKey })
		this.callbacks.onFieldsAdded([field], form, formKey)
	}

	private unregisterField(
		field: DriftInputElement,
		form: HTMLFormElement,
		formKey: string
	): void {
		this.trackedFields.delete(field)
		this.callbacks.onFieldRemoved(field, form, formKey)
	}

	private findParentForm(element: Element): HTMLFormElement | null {
		let current: Element | null = element

		while (current) {
			if (current instanceof HTMLFormElement) {
				return this.trackedForms.has(current) ? current : null
			}
			current = current.parentElement
		}

		return null
	}

	private isInputElement(element: Element): element is DriftInputElement {
		return (
			element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement ||
			element instanceof HTMLSelectElement
		)
	}
}
