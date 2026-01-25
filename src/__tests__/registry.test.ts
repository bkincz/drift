/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect, beforeEach } from 'vitest'
import { SchemaRegistry } from '../registry'
import type { DriftSchema, DriftFieldSchema } from '../types'

/*
 *   TEST SETUP
 ***************************************************************************************************/
let registry: SchemaRegistry

beforeEach(() => {
	registry = new SchemaRegistry()
})

/*
 *   BASIC OPERATIONS TESTS
 ***************************************************************************************************/
describe('SchemaRegistry - Basic Operations', () => {
	it('registers a schema', () => {
		const schema: DriftSchema = {
			validate: () => ({ success: true }),
		}
		registry.register('testForm', schema)
		expect(registry.has('testForm')).toBe(true)
	})

	it('retrieves a registered schema', () => {
		const schema: DriftSchema = {
			validate: () => ({ success: true }),
		}
		registry.register('testForm', schema)
		expect(registry.get('testForm')).toBe(schema)
	})

	it('returns undefined for non-existent schema', () => {
		expect(registry.get('nonexistent')).toBeUndefined()
	})

	it('unregisters a schema', () => {
		const schema: DriftSchema = {
			validate: () => ({ success: true }),
		}
		registry.register('testForm', schema)
		registry.unregister('testForm')
		expect(registry.has('testForm')).toBe(false)
	})

	it('clears all schemas', () => {
		registry.register('form1', { validate: () => ({ success: true }) })
		registry.register('form2', { validate: () => ({ success: true }) })
		registry.clear()
		expect(registry.keys()).toEqual([])
	})

	it('returns all registered keys', () => {
		registry.register('form1', { validate: () => ({ success: true }) })
		registry.register('form2', { validate: () => ({ success: true }) })
		registry.register('form3', { validate: () => ({ success: true }) })
		expect(registry.keys()).toEqual(['form1', 'form2', 'form3'])
	})
})

/*
 *   FIELD SCHEMA TESTS
 ***************************************************************************************************/
describe('SchemaRegistry - Field Schema', () => {
	it('gets a field schema', () => {
		const fieldSchema: DriftFieldSchema = {
			validate: () => ({ success: true }),
			validateOn: 'blur',
		}
		const schema: DriftSchema = {
			fields: {
				email: fieldSchema,
			},
		}
		registry.register('testForm', schema)
		expect(registry.getFieldSchema('testForm', 'email')).toBe(fieldSchema)
	})

	it('returns undefined for non-existent field schema', () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: () => ({ success: true }),
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)
		expect(registry.getFieldSchema('testForm', 'nonexistent')).toBeUndefined()
	})

	it('returns undefined for field schema when form has no fields', () => {
		const schema: DriftSchema = {
			validate: () => ({ success: true }),
		}
		registry.register('testForm', schema)
		expect(registry.getFieldSchema('testForm', 'email')).toBeUndefined()
	})

	it('checks if field schema exists', () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: () => ({ success: true }),
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)
		expect(registry.hasFieldSchema('testForm', 'email')).toBe(true)
		expect(registry.hasFieldSchema('testForm', 'nonexistent')).toBe(false)
	})
})

/*
 *   FIELD VALIDATION TESTS
 ***************************************************************************************************/
describe('SchemaRegistry - Field Validation', () => {
	it('validates a field successfully', async () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: value => ({
						success: typeof value === 'string' && value.includes('@'),
					}),
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)

		const result = await registry.validateField('testForm', 'email', 'test@example.com', {})
		expect(result.success).toBe(true)
	})

	it('returns validation errors for invalid field', async () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: value => {
						if (typeof value !== 'string' || !value.includes('@')) {
							return {
								success: false,
								errors: { email: ['Invalid email format'] },
							}
						}
						return { success: true }
					},
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)

		const result = await registry.validateField('testForm', 'email', 'invalid', {})
		expect(result.success).toBe(false)
		expect(result.errors?.email).toContain('Invalid email format')
	})

	it('returns success for non-existent field schema', async () => {
		const schema: DriftSchema = {
			validate: () => ({ success: true }),
		}
		registry.register('testForm', schema)

		const result = await registry.validateField('testForm', 'nonexistent', 'value', {})
		expect(result.success).toBe(true)
	})

	it('returns success for non-existent form', async () => {
		const result = await registry.validateField('nonexistent', 'field', 'value', {})
		expect(result.success).toBe(true)
	})

	it('passes all values to field validator', async () => {
		let receivedAllValues: Record<string, unknown> = {}
		const schema: DriftSchema = {
			fields: {
				password: {
					validate: (_value, allValues) => {
						receivedAllValues = allValues
						return { success: true }
					},
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)

		const allValues = { username: 'john', password: 'secret' }
		await registry.validateField('testForm', 'password', 'secret', allValues)
		expect(receivedAllValues).toEqual(allValues)
	})

	it('handles async field validation', async () => {
		const schema: DriftSchema = {
			fields: {
				username: {
					validate: async value => {
						await new Promise(resolve => setTimeout(resolve, 10))
						return {
							success: value === 'available',
						}
					},
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)

		const result = await registry.validateField('testForm', 'username', 'available', {})
		expect(result.success).toBe(true)
	})
})

/*
 *   FORM VALIDATION TESTS
 ***************************************************************************************************/
describe('SchemaRegistry - Form Validation', () => {
	it('validates a form successfully', async () => {
		const schema: DriftSchema = {
			validate: values => ({
				success: Object.keys(values).length > 0,
			}),
		}
		registry.register('testForm', schema)

		const result = await registry.validateForm('testForm', { name: 'John' })
		expect(result.success).toBe(true)
	})

	it('returns validation errors for invalid form', async () => {
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
		registry.register('testForm', schema)

		const result = await registry.validateForm('testForm', {})
		expect(result.success).toBe(false)
		expect(result.errors?.email).toContain('Email is required')
		expect(result.errors?.password).toContain('Password is required')
	})

	it('returns success for form without validate function', async () => {
		const schema: DriftSchema = {
			fields: {
				email: {
					validate: () => ({ success: true }),
					validateOn: 'blur',
				},
			},
		}
		registry.register('testForm', schema)

		const result = await registry.validateForm('testForm', {})
		expect(result.success).toBe(true)
	})

	it('returns success for non-existent form', async () => {
		const result = await registry.validateForm('nonexistent', {})
		expect(result.success).toBe(true)
	})

	it('handles async form validation', async () => {
		const schema: DriftSchema = {
			validate: async values => {
				await new Promise(resolve => setTimeout(resolve, 10))
				return {
					success: values.email === 'valid@example.com',
				}
			},
		}
		registry.register('testForm', schema)

		const result = await registry.validateForm('testForm', {
			email: 'valid@example.com',
		})
		expect(result.success).toBe(true)
	})
})
