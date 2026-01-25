/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getInputs, isInDOM, isHidden } from '../visibility'

/*
 *   TEST SETUP
 ***************************************************************************************************/
let container: HTMLDivElement

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
})

afterEach(() => {
	document.body.removeChild(container)
})

/*
 *   GET INPUTS TESTS
 ***************************************************************************************************/
describe('getInputs', () => {
	it('returns all named input elements', () => {
		container.innerHTML = `
			<input name="email" type="email" />
			<input name="password" type="password" />
			<textarea name="message"></textarea>
			<select name="country"><option>US</option></select>
		`
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(4)
	})

	it('excludes inputs without names', () => {
		container.innerHTML = `
			<input name="email" type="email" />
			<input type="text" />
			<input name="password" type="password" />
		`
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(2)
	})

	it('excludes inputs with hidden attribute', () => {
		container.innerHTML = `
			<input name="email" type="email" />
			<input name="hidden" type="text" data-drift-hidden />
			<input name="password" type="password" />
		`
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(2)
		expect(inputs.map(i => i.name)).toEqual(['email', 'password'])
	})

	it('uses custom hidden attribute', () => {
		container.innerHTML = `
			<input name="email" type="email" />
			<input name="hidden" type="text" data-custom-hidden />
			<input name="password" type="password" />
		`
		const inputs = getInputs(container, 'data-custom-hidden')
		expect(inputs).toHaveLength(2)
		expect(inputs.map(i => i.name)).toEqual(['email', 'password'])
	})

	it('returns empty array for container with no inputs', () => {
		container.innerHTML = '<div><span>No inputs here</span></div>'
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(0)
	})

	it('finds nested inputs', () => {
		container.innerHTML = `
			<div>
				<div>
					<input name="nested" type="text" />
				</div>
			</div>
		`
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(1)
		expect(inputs[0].name).toBe('nested')
	})

	it('includes all input types', () => {
		container.innerHTML = `
			<input name="text" type="text" />
			<input name="checkbox" type="checkbox" />
			<input name="radio" type="radio" />
			<input name="number" type="number" />
			<input name="date" type="date" />
			<input name="file" type="file" />
		`
		const inputs = getInputs(container)
		expect(inputs).toHaveLength(6)
	})
})

/*
 *   IS IN DOM TESTS
 ***************************************************************************************************/
describe('isInDOM', () => {
	it('returns true for element in DOM', () => {
		const element = document.createElement('div')
		container.appendChild(element)
		expect(isInDOM(element)).toBe(true)
	})

	it('returns false for detached element', () => {
		const element = document.createElement('div')
		expect(isInDOM(element)).toBe(false)
	})

	it('returns false for removed element', () => {
		const element = document.createElement('div')
		container.appendChild(element)
		container.removeChild(element)
		expect(isInDOM(element)).toBe(false)
	})

	it('returns true for deeply nested element', () => {
		const outer = document.createElement('div')
		const middle = document.createElement('div')
		const inner = document.createElement('div')
		outer.appendChild(middle)
		middle.appendChild(inner)
		container.appendChild(outer)
		expect(isInDOM(inner)).toBe(true)
	})
})

/*
 *   IS HIDDEN TESTS
 ***************************************************************************************************/
describe('isHidden', () => {
	it('returns true for element with default hidden attribute', () => {
		const element = document.createElement('input')
		element.setAttribute('data-drift-hidden', '')
		expect(isHidden(element)).toBe(true)
	})

	it('returns false for element without hidden attribute', () => {
		const element = document.createElement('input')
		expect(isHidden(element)).toBe(false)
	})

	it('uses custom hidden attribute', () => {
		const element = document.createElement('input')
		element.setAttribute('data-custom-hidden', '')
		expect(isHidden(element, 'data-custom-hidden')).toBe(true)
		expect(isHidden(element)).toBe(false)
	})

	it('returns true regardless of attribute value', () => {
		const element = document.createElement('input')
		element.setAttribute('data-drift-hidden', 'false')
		expect(isHidden(element)).toBe(true)
	})
})
