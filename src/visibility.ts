/*
 *   IMPORTS
 ***************************************************************************************************/
import type { DriftInputElement } from './types'

/*
 *   VISIBILITY UTILITIES
 ***************************************************************************************************/
/**
 * Get all visible input elements within a container
 */
export function getInputs(
	container: Element,
	hiddenAttribute = 'data-drift-hidden'
): DriftInputElement[] {
	const inputs = container.querySelectorAll<DriftInputElement>('input, textarea, select')

	return Array.from(inputs).filter(input => input.name && !input.hasAttribute(hiddenAttribute))
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
