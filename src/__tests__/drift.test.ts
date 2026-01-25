/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Drift } from '../drift'
import type { DriftSchema } from '../types'

/*
 *   TEST SETUP
 ***************************************************************************************************/
let drift: Drift
let container: HTMLDivElement

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	drift = new Drift()
})

afterEach(() => {
	drift.disconnect()
	document.body.removeChild(container)
})

/*
 *   HELPER FUNCTIONS
 ***************************************************************************************************/
async function waitForMutations(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 50))
}

function createForm(formKey: string, fields: string[] = []): HTMLFormElement {
	const form = document.createElement('form')
	form.setAttribute('data-drift-form', formKey)

	fields.forEach(name => {
		const input = document.createElement('input')
		input.name = name
		input.type = 'text'
		form.appendChild(input)
	})

	return form
}

function triggerInput(input: HTMLInputElement, value: string): void {
	input.value = value
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

function triggerBlur(input: HTMLInputElement): void {
	input.dispatchEvent(new Event('blur', { bubbles: true }))
}

/*
 *   INITIALIZATION TESTS
 ***************************************************************************************************/
describe('Drift - Initialization', () => {
	it('creates instance with default config', () => {
		expect(drift).toBeInstanceOf(Drift)
	})

	it('creates instance with custom config', () => {
		const customDrift = new Drift({
			formAttribute: 'data-custom-form',
			persist: false,
		})
		expect(customDrift).toBeInstanceOf(Drift)
		customDrift.disconnect()
	})

	it('starts observing the DOM', async () => {
		const form = createForm('testForm')
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		expect(drift.getForm('testForm')).toBeDefined()
	})
})

/*
 *   FORM STATE TESTS
 ***************************************************************************************************/
describe('Drift - Form State', () => {
	it('creates initial form state when form is detected', async () => {
		const form = createForm('testForm')
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()

		const state = drift.getForm('testForm')
		expect(state).toEqual({
			values: {},
			errors: {},
			touched: {},
			dirty: {},
			isValid: true,
			isSubmitting: false,
			isValidating: false,
		})
	})

	it('returns undefined for non-existent form', () => {
		expect(drift.getForm('nonexistent')).toBeUndefined()
	})

	it('returns all forms', async () => {
		const form1 = createForm('form1')
		const form2 = createForm('form2')
		container.appendChild(form1)
		container.appendChild(form2)
		drift.observe(container)
		await waitForMutations()

		const forms = drift.getAllForms()
		expect(Object.keys(forms)).toEqual(['form1', 'form2'])
	})

	it('captures initial field values', async () => {
		const form = createForm('testForm')
		const input = document.createElement('input')
		input.name = 'username'
		input.type = 'text'
		input.value = 'initialValue'
		form.appendChild(input)
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		expect(drift.getValue('testForm', 'username')).toBe('initialValue')
	})
})

/*
 *   VALUE OPERATIONS TESTS
 ***************************************************************************************************/
describe('Drift - Value Operations', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email', 'password'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('sets a value programmatically', () => {
		drift.setValue('testForm', 'email', 'test@example.com')
		expect(drift.getValue('testForm', 'email')).toBe('test@example.com')
	})

	it('marks field as dirty when value is set', () => {
		drift.setValue('testForm', 'email', 'test@example.com')
		expect(drift.isDirty('testForm', 'email')).toBe(true)
	})

	it('updates DOM element when value is set', () => {
		drift.setValue('testForm', 'email', 'test@example.com')
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		expect(input.value).toBe('test@example.com')
	})

	it('sets multiple values at once', () => {
		drift.setValues('testForm', {
			email: 'test@example.com',
			password: 'secret123',
		})
		expect(drift.getValue('testForm', 'email')).toBe('test@example.com')
		expect(drift.getValue('testForm', 'password')).toBe('secret123')
	})

	it('returns undefined for non-existent field', () => {
		expect(drift.getValue('testForm', 'nonexistent')).toBeUndefined()
	})

	it('handles nested field names', () => {
		drift.setValue('testForm', 'user.profile.name', 'John')
		expect(drift.getValue('testForm', 'user.profile.name')).toBe('John')
	})
})

/*
 *   INPUT EVENT TESTS
 ***************************************************************************************************/
describe('Drift - Input Events', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('captures input changes', () => {
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		triggerInput(input, 'typed@example.com')

		expect(drift.getValue('testForm', 'email')).toBe('typed@example.com')
	})

	it('marks field as dirty on input', () => {
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		triggerInput(input, 'typed@example.com')

		expect(drift.isDirty('testForm', 'email')).toBe(true)
	})

	it('marks field as touched on blur', () => {
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		triggerBlur(input)

		expect(drift.isTouched('testForm', 'email')).toBe(true)
	})

	it('reports form as dirty when any field is dirty', () => {
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		triggerInput(input, 'value')

		expect(drift.isFormDirty('testForm')).toBe(true)
	})

	it('reports form as not dirty initially', () => {
		expect(drift.isFormDirty('testForm')).toBe(false)
	})
})

/*
 *   ERROR HANDLING TESTS
 ***************************************************************************************************/
describe('Drift - Error Handling', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('sets errors for a field', () => {
		drift.setErrors('testForm', {
			email: ['Invalid email', 'Email is required'],
		})

		expect(drift.getErrors('testForm', 'email')).toEqual(['Invalid email', 'Email is required'])
	})

	it('marks form as invalid when errors exist', () => {
		drift.setErrors('testForm', {
			email: ['Invalid email'],
		})

		const state = drift.getForm('testForm')
		expect(state?.isValid).toBe(false)
	})

	it('clears all errors for a form', () => {
		drift.setErrors('testForm', {
			email: ['Error 1'],
		})
		drift.clearErrors('testForm')

		expect(drift.getAllErrors('testForm')).toEqual({})
	})

	it('clears errors for a specific field', () => {
		drift.setErrors('testForm', {
			email: ['Error 1'],
		})
		drift.clearErrors('testForm', 'email')

		expect(drift.getErrors('testForm', 'email')).toEqual([])
	})

	it('returns empty array for field without errors', () => {
		expect(drift.getErrors('testForm', 'email')).toEqual([])
	})

	it('returns empty object for form without errors', () => {
		expect(drift.getAllErrors('testForm')).toEqual({})
	})
})

/*
 *   VALIDATION TESTS
 ***************************************************************************************************/
describe('Drift - Validation', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email', 'password'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('validates a field with schema', async () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: value => ({
						success: typeof value === 'string' && value.includes('@'),
						errors:
							typeof value === 'string' && value.includes('@')
								? undefined
								: { email: ['Invalid email format'] },
					}),
					validateOn: 'blur',
				},
			},
		}
		drift.registerSchema('testForm', schema)
		drift.setValue('testForm', 'email', 'invalid')

		const isValid = await drift.validateField('testForm', 'email')

		expect(isValid).toBe(false)
		expect(drift.getErrors('testForm', 'email')).toContain('Invalid email format')
	})

	it('validates entire form', async () => {
		const schema: DriftSchema = {
			validate: values => {
				const errors: Record<string, string[]> = {}
				if (!values.email) {
					errors.email = ['Email is required']
				}
				if (!values.password) {
					errors.password = ['Password is required']
				}
				return {
					success: Object.keys(errors).length === 0,
					errors: Object.keys(errors).length > 0 ? errors : undefined,
				}
			},
		}
		drift.registerSchema('testForm', schema)

		const isValid = await drift.validateForm('testForm')

		expect(isValid).toBe(false)
		expect(drift.getErrors('testForm', 'email')).toContain('Email is required')
	})

	it('clears errors when field becomes valid', async () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: value => ({
						success: typeof value === 'string' && value.includes('@'),
						errors:
							typeof value === 'string' && value.includes('@')
								? undefined
								: { email: ['Invalid email'] },
					}),
					validateOn: 'blur',
				},
			},
		}
		drift.registerSchema('testForm', schema)
		drift.setValue('testForm', 'email', 'invalid')
		await drift.validateField('testForm', 'email')

		drift.setValue('testForm', 'email', 'valid@example.com')
		await drift.validateField('testForm', 'email')

		expect(drift.getErrors('testForm', 'email')).toEqual([])
	})

	it('returns true for form without schema', async () => {
		const isValid = await drift.validateForm('testForm')
		expect(isValid).toBe(true)
	})

	it('unregisters schema', async () => {
		const schema: DriftSchema = {
			validate: () => ({ success: false, errors: { email: ['Error'] } }),
		}
		drift.registerSchema('testForm', schema)
		drift.unregisterSchema('testForm')

		const isValid = await drift.validateForm('testForm')
		expect(isValid).toBe(true)
	})
})

/*
 *   FORM SUBMISSION TESTS
 ***************************************************************************************************/
describe('Drift - Form Submission', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('calls submit handler on successful submission', async () => {
		const handler = vi.fn()
		drift.onSubmit('testForm', handler)
		drift.setValue('testForm', 'email', 'test@example.com')

		await drift.submit('testForm')

		expect(handler).toHaveBeenCalledWith({ email: 'test@example.com' }, 'testForm')
	})

	it('does not call handler when validation fails', async () => {
		const handler = vi.fn()
		const schema: DriftSchema = {
			validate: () => ({ success: false, errors: { email: ['Required'] } }),
		}
		drift.registerSchema('testForm', schema)
		drift.onSubmit('testForm', handler)

		await drift.submit('testForm')

		expect(handler).not.toHaveBeenCalled()
	})

	it('sets isSubmitting during submission', async () => {
		let stateWhileSubmitting: boolean | undefined
		const handler = vi.fn(async () => {
			stateWhileSubmitting = drift.getForm('testForm')?.isSubmitting
			await new Promise(resolve => setTimeout(resolve, 10))
		})
		drift.onSubmit('testForm', handler)

		await drift.submit('testForm')

		expect(stateWhileSubmitting).toBe(true)
		expect(drift.getForm('testForm')?.isSubmitting).toBe(false)
	})

	it('returns false when form does not exist', async () => {
		const result = await drift.submit('nonexistent')
		expect(result).toBe(false)
	})

	it('unsubscribes submit handler', async () => {
		const handler = vi.fn()
		const unsubscribe = drift.onSubmit('testForm', handler)
		unsubscribe()

		await drift.submit('testForm')

		expect(handler).not.toHaveBeenCalled()
	})

	it('handles submit handler errors gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const handler = vi.fn().mockRejectedValue(new Error('Handler error'))
		drift.onSubmit('testForm', handler)

		await drift.submit('testForm')

		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})
})

/*
 *   FORM RESET TESTS
 ***************************************************************************************************/
describe('Drift - Form Reset', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email', 'password'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('resets form state', () => {
		drift.setValue('testForm', 'email', 'test@example.com')
		drift.setErrors('testForm', { email: ['Error'] })

		drift.resetForm('testForm')

		const state = drift.getForm('testForm')
		expect(state?.values).toEqual({})
		expect(state?.errors).toEqual({})
		expect(state?.touched).toEqual({})
		expect(state?.dirty).toEqual({})
	})

	it('clears DOM input values', () => {
		const input = container.querySelector('input[name="email"]') as HTMLInputElement
		input.value = 'test@example.com'

		drift.resetForm('testForm')

		expect(input.value).toBe('')
	})
})

/*
 *   SUBSCRIPTION TESTS
 ***************************************************************************************************/
describe('Drift - Subscriptions', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('subscribes to form state changes', () => {
		const callback = vi.fn()
		drift.subscribe('testForm', callback)

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(callback).toHaveBeenCalled()
	})

	it('unsubscribes from form state changes', () => {
		const callback = vi.fn()
		const unsubscribe = drift.subscribe('testForm', callback)

		// Clear any initial calls from subscription
		callback.mockClear()

		unsubscribe()

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(callback).not.toHaveBeenCalled()
	})

	it('subscribes to all forms', () => {
		const callback = vi.fn()
		drift.subscribeAll(callback)

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(callback).toHaveBeenCalled()
	})
})

/*
 *   EVENT LISTENER TESTS
 ***************************************************************************************************/
describe('Drift - Event Listeners', () => {
	beforeEach(async () => {
		const form = createForm('testForm', ['email'])
		container.appendChild(form)
		drift.observe(container)
		await waitForMutations()
	})

	it('emits field:change event', () => {
		const listener = vi.fn()
		drift.on('field:change', listener)

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'field:change',
				formKey: 'testForm',
				fieldName: 'email',
				value: 'test@example.com',
			})
		)
	})

	it('emits validation:start and validation:end events', async () => {
		const startListener = vi.fn()
		const endListener = vi.fn()
		drift.on('validation:start', startListener)
		drift.on('validation:end', endListener)

		await drift.validateForm('testForm')

		expect(startListener).toHaveBeenCalled()
		expect(endListener).toHaveBeenCalled()
	})

	it('emits submit:start and submit:end events', async () => {
		const startListener = vi.fn()
		const endListener = vi.fn()
		drift.on('submit:start', startListener)
		drift.on('submit:end', endListener)

		await drift.submit('testForm')

		expect(startListener).toHaveBeenCalled()
		expect(endListener).toHaveBeenCalled()
	})

	it('supports wildcard event listener', () => {
		const listener = vi.fn()
		drift.on('*', listener)

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'field:change' }))
	})

	it('removes event listener with off()', () => {
		const listener = vi.fn()
		drift.on('field:change', listener)
		drift.off('field:change', listener)

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(listener).not.toHaveBeenCalled()
	})

	it('removes event listener with returned unsubscribe function', () => {
		const listener = vi.fn()
		const unsubscribe = drift.on('field:change', listener)
		unsubscribe()

		drift.setValue('testForm', 'email', 'test@example.com')

		expect(listener).not.toHaveBeenCalled()
	})
})

/*
 *   INPUT TYPE TESTS
 ***************************************************************************************************/
describe('Drift - Input Types', () => {
	it('handles checkbox inputs', async () => {
		const form = document.createElement('form')
		form.setAttribute('data-drift-form', 'testForm')
		const checkbox = document.createElement('input')
		checkbox.name = 'agree'
		checkbox.type = 'checkbox'
		form.appendChild(checkbox)
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		checkbox.checked = true
		checkbox.dispatchEvent(new Event('input', { bubbles: true }))

		expect(drift.getValue('testForm', 'agree')).toBe(true)
	})

	it('handles select inputs', async () => {
		const form = document.createElement('form')
		form.setAttribute('data-drift-form', 'testForm')
		const select = document.createElement('select')
		select.name = 'country'
		select.innerHTML = '<option value="us">US</option><option value="uk">UK</option>'
		form.appendChild(select)
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		select.value = 'uk'
		select.dispatchEvent(new Event('change', { bubbles: true }))

		expect(drift.getValue('testForm', 'country')).toBe('uk')
	})

	it('handles textarea inputs', async () => {
		const form = document.createElement('form')
		form.setAttribute('data-drift-form', 'testForm')
		const textarea = document.createElement('textarea')
		textarea.name = 'message'
		form.appendChild(textarea)
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		textarea.value = 'Hello world'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))

		expect(drift.getValue('testForm', 'message')).toBe('Hello world')
	})

	it('handles number inputs', async () => {
		const form = document.createElement('form')
		form.setAttribute('data-drift-form', 'testForm')
		const input = document.createElement('input')
		input.name = 'age'
		input.type = 'number'
		form.appendChild(input)
		container.appendChild(form)

		drift.observe(container)
		await waitForMutations()

		input.value = '25'
		input.dispatchEvent(new Event('input', { bubbles: true }))

		expect(drift.getValue('testForm', 'age')).toBe(25)
	})
})
