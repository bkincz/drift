/*
 *   INPUT UTILITIES
 ***************************************************************************************************/
import type { DriftInputElement } from './types'

export function getInputValue(element: DriftInputElement): unknown {
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

export function setInputValue(element: DriftInputElement, value: unknown): void {
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

export function isEmpty(value: unknown): boolean {
	if (value === undefined || value === null || value === '') {
		return true
	}
	if (Array.isArray(value) && value.length === 0) {
		return true
	}
	return false
}
