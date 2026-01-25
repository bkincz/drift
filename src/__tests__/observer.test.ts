/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DriftObserver } from '../observer'
import type { DriftObserverCallbacks, DriftObserverConfig } from '../observer'

/*
 *   TEST SETUP
 ***************************************************************************************************/
let observer: DriftObserver
let container: HTMLDivElement
let callbacks: DriftObserverCallbacks
let config: DriftObserverConfig

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)

	callbacks = {
		onFormAdded: vi.fn(),
		onFormRemoved: vi.fn(),
		onFieldsAdded: vi.fn(),
		onFieldRemoved: vi.fn(),
	}

	config = {
		formAttribute: 'data-drift-form',
		hiddenAttribute: 'data-drift-hidden',
		debounceMs: 0,
	}

	observer = new DriftObserver(callbacks, config)
})

afterEach(() => {
	observer.disconnect()
	document.body.removeChild(container)
})

/*
 *   HELPER FUNCTIONS
 ***************************************************************************************************/
async function waitForMutations(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 10))
}

function createForm(formKey: string, innerHTML = ''): HTMLFormElement {
	const form = document.createElement('form')
	form.setAttribute('data-drift-form', formKey)
	form.innerHTML = innerHTML
	return form
}

/*
 *   INITIAL SCAN TESTS
 ***************************************************************************************************/
describe('DriftObserver - Initial Scan', () => {
	it('detects existing forms on observe', () => {
		container.innerHTML = '<form data-drift-form="myForm"></form>'
		observer.observe(container)

		expect(callbacks.onFormAdded).toHaveBeenCalledTimes(1)
		expect(callbacks.onFormAdded).toHaveBeenCalledWith(expect.any(HTMLFormElement), 'myForm')
	})

	it('detects existing fields within forms', () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<input name="email" type="email" />
				<input name="password" type="password" />
			</form>
		`
		observer.observe(container)

		expect(callbacks.onFieldsAdded).toHaveBeenCalledTimes(1)
		expect(callbacks.onFieldsAdded).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: 'email' }),
				expect.objectContaining({ name: 'password' }),
			]),
			expect.any(HTMLFormElement),
			'myForm'
		)
	})

	it('ignores forms without the form attribute', () => {
		container.innerHTML = '<form></form>'
		observer.observe(container)

		expect(callbacks.onFormAdded).not.toHaveBeenCalled()
	})

	it('ignores hidden fields', () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<input name="visible" type="text" />
				<input name="hidden" type="text" data-drift-hidden />
			</form>
		`
		observer.observe(container)

		expect(callbacks.onFieldsAdded).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ name: 'visible' })]),
			expect.any(HTMLFormElement),
			'myForm'
		)
		const fields = (callbacks.onFieldsAdded as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(fields).toHaveLength(1)
	})

	it('ignores fields without names', () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<input name="named" type="text" />
				<input type="text" />
			</form>
		`
		observer.observe(container)

		const fields = (callbacks.onFieldsAdded as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(fields).toHaveLength(1)
		expect(fields[0].name).toBe('named')
	})

	it('detects multiple forms', () => {
		container.innerHTML = `
			<form data-drift-form="form1"></form>
			<form data-drift-form="form2"></form>
			<form data-drift-form="form3"></form>
		`
		observer.observe(container)

		expect(callbacks.onFormAdded).toHaveBeenCalledTimes(3)
	})
})

/*
 *   DYNAMIC FORM TESTS
 ***************************************************************************************************/
describe('DriftObserver - Dynamic Forms', () => {
	it('detects dynamically added forms', async () => {
		observer.observe(container)
		const form = createForm('dynamicForm')
		container.appendChild(form)

		await waitForMutations()

		expect(callbacks.onFormAdded).toHaveBeenCalledWith(form, 'dynamicForm')
	})

	it('detects dynamically removed forms', async () => {
		const form = createForm('myForm')
		container.appendChild(form)
		observer.observe(container)

		container.removeChild(form)
		await waitForMutations()

		expect(callbacks.onFormRemoved).toHaveBeenCalledWith(form, 'myForm')
	})

	it('detects nested forms added via parent element', async () => {
		observer.observe(container)

		const wrapper = document.createElement('div')
		wrapper.innerHTML = '<form data-drift-form="nestedForm"></form>'
		container.appendChild(wrapper)

		await waitForMutations()

		expect(callbacks.onFormAdded).toHaveBeenCalledWith(
			expect.any(HTMLFormElement),
			'nestedForm'
		)
	})
})

/*
 *   DYNAMIC FIELD TESTS
 ***************************************************************************************************/
describe('DriftObserver - Dynamic Fields', () => {
	it('detects dynamically added fields', async () => {
		const form = createForm('myForm')
		container.appendChild(form)
		observer.observe(container)

		const input = document.createElement('input')
		input.name = 'dynamicField'
		input.type = 'text'
		form.appendChild(input)

		await waitForMutations()

		expect(callbacks.onFieldsAdded).toHaveBeenCalledWith(
			[expect.objectContaining({ name: 'dynamicField' })],
			form,
			'myForm'
		)
	})

	it('detects dynamically removed fields', async () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<input name="email" type="email" />
			</form>
		`
		observer.observe(container)

		const form = container.querySelector('form')!
		const input = container.querySelector('input')!
		form.removeChild(input)

		await waitForMutations()

		expect(callbacks.onFieldRemoved).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'email' }),
			form,
			'myForm'
		)
	})

	it('ignores fields added to non-tracked forms', async () => {
		container.innerHTML = '<form><input name="existing" /></form>'
		observer.observe(container)

		const form = container.querySelector('form')!
		const input = document.createElement('input')
		input.name = 'newField'
		form.appendChild(input)

		await waitForMutations()

		expect(callbacks.onFieldsAdded).not.toHaveBeenCalled()
	})
})

/*
 *   DISCONNECT TESTS
 ***************************************************************************************************/
describe('DriftObserver - Disconnect', () => {
	it('stops observing after disconnect', async () => {
		observer.observe(container)
		observer.disconnect()

		const form = createForm('afterDisconnect')
		container.appendChild(form)

		await waitForMutations()

		expect(callbacks.onFormAdded).not.toHaveBeenCalled()
	})

	it('clears tracked forms on disconnect', () => {
		container.innerHTML = '<form data-drift-form="myForm"></form>'
		observer.observe(container)
		observer.disconnect()

		// Re-observe to verify forms are cleared
		observer.observe(container)
		expect(callbacks.onFormAdded).toHaveBeenCalledTimes(2)
	})

	it('can re-observe after disconnect', async () => {
		observer.observe(container)
		observer.disconnect()
		observer.observe(container)

		const form = createForm('newForm')
		container.appendChild(form)

		await waitForMutations()

		expect(callbacks.onFormAdded).toHaveBeenCalledWith(form, 'newForm')
	})
})

/*
 *   RESCAN TESTS
 ***************************************************************************************************/
describe('DriftObserver - Rescan', () => {
	it('rescans the root element', () => {
		observer.observe(container)

		// Manually add form without triggering mutation
		const form = createForm('manualForm')
		container.appendChild(form)

		// Clear previous calls
		vi.clearAllMocks()

		observer.rescan()

		expect(callbacks.onFormAdded).toHaveBeenCalledWith(form, 'manualForm')
	})

	it('does nothing if not observing', () => {
		observer.rescan()
		expect(callbacks.onFormAdded).not.toHaveBeenCalled()
	})
})

/*
 *   EDGE CASES
 ***************************************************************************************************/
describe('DriftObserver - Edge Cases', () => {
	it('handles form element as root', () => {
		const form = createForm('rootForm', '<input name="email" type="email" />')
		document.body.appendChild(form)

		observer.observe(form)

		expect(callbacks.onFormAdded).toHaveBeenCalledWith(form, 'rootForm')
		expect(callbacks.onFieldsAdded).toHaveBeenCalled()

		document.body.removeChild(form)
	})

	it('handles rapid add/remove cycles', async () => {
		observer.observe(container)

		const form = createForm('rapidForm')
		container.appendChild(form)
		container.removeChild(form)

		await waitForMutations()

		// Form was added and removed in same batch, so neither should be called
		// (they cancel each other out in the deduplication logic)
	})

	it('handles multiple input types', () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<input name="text" type="text" />
				<textarea name="textarea"></textarea>
				<select name="select"><option>A</option></select>
			</form>
		`
		observer.observe(container)

		const fields = (callbacks.onFieldsAdded as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(fields).toHaveLength(3)
	})

	it('handles deeply nested fields', () => {
		container.innerHTML = `
			<form data-drift-form="myForm">
				<div>
					<div>
						<div>
							<input name="deepField" type="text" />
						</div>
					</div>
				</div>
			</form>
		`
		observer.observe(container)

		const fields = (callbacks.onFieldsAdded as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(fields).toHaveLength(1)
		expect(fields[0].name).toBe('deepField')
	})
})
