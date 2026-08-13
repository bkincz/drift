/*
 *   IMPORTS
 ***************************************************************************************************/
import type { DriftInputElement } from './types.js'

/*
 *   VISIBILITY UTILITIES
 ***************************************************************************************************/
const FIELDS = 'input, textarea, select'

function claimedByNested(container: Element, formAttribute: string): Set<Element> {
	const claimed = new Set<Element>()

	for (const nested of container.querySelectorAll<Element>(`[${formAttribute}]`)) {
		for (const input of nested.querySelectorAll(FIELDS)) {
			claimed.add(input)
		}
	}

	return claimed
}

export function getInputs(
	container: Element,
	hiddenAttribute = 'data-drift-hidden',
	formAttribute = 'data-drift-form'
): DriftInputElement[] {
	const inputs = container.querySelectorAll<DriftInputElement>(FIELDS)
	const claimed = claimedByNested(container, formAttribute)

	return Array.from(inputs).filter(
		input => input.name && !input.hasAttribute(hiddenAttribute) && !claimed.has(input)
	)
}

/**
 * Check if an element is connected to the DOM
 */
export function isInDOM(element: Element): boolean {
	return element.isConnected
}

/**
 * Check if an element is marked as hidden
 */
export function isHidden(element: Element, hiddenAttribute = 'data-drift-hidden'): boolean {
	return element.hasAttribute(hiddenAttribute)
}
