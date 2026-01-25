/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect } from 'vitest'
import { parseFieldName, setNestedValue, getNestedValue, deleteNestedValue } from '../parser'

/*
 *   PARSE FIELD NAME TESTS
 ***************************************************************************************************/
describe('parseFieldName', () => {
	it('parses simple field names', () => {
		const segments = parseFieldName('username')
		expect(segments).toEqual([{ key: 'username', isArray: false }])
	})

	it('parses dot notation paths', () => {
		const segments = parseFieldName('user.name')
		expect(segments).toEqual([
			{ key: 'user', isArray: false },
			{ key: 'name', isArray: false },
		])
	})

	it('parses deeply nested dot notation', () => {
		const segments = parseFieldName('user.profile.settings.theme')
		expect(segments).toEqual([
			{ key: 'user', isArray: false },
			{ key: 'profile', isArray: false },
			{ key: 'settings', isArray: false },
			{ key: 'theme', isArray: false },
		])
	})

	it('parses array bracket notation', () => {
		const segments = parseFieldName('items[0]')
		expect(segments).toEqual([{ key: 'items', isArray: true, index: 0 }])
	})

	it('parses array with nested property', () => {
		const segments = parseFieldName('items[0].name')
		expect(segments).toEqual([
			{ key: 'items', isArray: true, index: 0 },
			{ key: 'name', isArray: false },
		])
	})

	it('parses complex nested arrays', () => {
		const segments = parseFieldName('users[0].addresses[1].street')
		expect(segments).toEqual([
			{ key: 'users', isArray: true, index: 0 },
			{ key: 'addresses', isArray: true, index: 1 },
			{ key: 'street', isArray: false },
		])
	})

	it('caches parsed results', () => {
		const fieldName = 'cached.field.name'
		const result1 = parseFieldName(fieldName)
		const result2 = parseFieldName(fieldName)
		expect(result1).toBe(result2)
	})
})

/*
 *   SET NESTED VALUE TESTS
 ***************************************************************************************************/
describe('setNestedValue', () => {
	it('sets simple values', () => {
		const obj = {}
		const result = setNestedValue(obj, 'name', 'John')
		expect(result).toEqual({ name: 'John' })
	})

	it('preserves existing values', () => {
		const obj = { existing: 'value' }
		const result = setNestedValue(obj, 'name', 'John')
		expect(result).toEqual({ existing: 'value', name: 'John' })
	})

	it('sets nested values with dot notation', () => {
		const obj = {}
		const result = setNestedValue(obj, 'user.name', 'John')
		expect(result).toEqual({ user: { name: 'John' } })
	})

	it('sets deeply nested values', () => {
		const obj = {}
		const result = setNestedValue(obj, 'a.b.c.d', 'deep')
		expect(result).toEqual({ a: { b: { c: { d: 'deep' } } } })
	})

	it('sets array values', () => {
		const obj = {}
		const result = setNestedValue(obj, 'items[0]', 'first')
		expect(result).toEqual({ items: ['first'] })
	})

	it('sets values at specific array indices', () => {
		const obj = { items: ['a', 'b', 'c'] }
		const result = setNestedValue(obj, 'items[1]', 'updated')
		expect(result).toEqual({ items: ['a', 'updated', 'c'] })
	})

	it('sets nested values within arrays', () => {
		const obj = {}
		const result = setNestedValue(obj, 'users[0].name', 'John')
		expect(result).toEqual({ users: [{ name: 'John' }] })
	})

	it('handles complex nested structures', () => {
		const obj = {}
		const result = setNestedValue(obj, 'form.users[0].addresses[0].city', 'NYC')
		expect(result).toEqual({
			form: {
				users: [{ addresses: [{ city: 'NYC' }] }],
			},
		})
	})

	it('does not mutate the original object', () => {
		const obj = { name: 'original' }
		const result = setNestedValue(obj, 'name', 'modified')
		expect(obj.name).toBe('original')
		expect(result.name).toBe('modified')
	})

	it('returns same object for empty path', () => {
		const obj = { test: 'value' }
		const result = setNestedValue(obj, '', 'ignored')
		// parseFieldName('') returns empty array, so should return obj as-is
		expect(result).toEqual({ test: 'value' })
	})
})

/*
 *   GET NESTED VALUE TESTS
 ***************************************************************************************************/
describe('getNestedValue', () => {
	it('gets simple values', () => {
		const obj = { name: 'John' }
		const result = getNestedValue(obj, 'name')
		expect(result).toBe('John')
	})

	it('gets nested values with dot notation', () => {
		const obj = { user: { name: 'John' } }
		const result = getNestedValue(obj, 'user.name')
		expect(result).toBe('John')
	})

	it('gets deeply nested values', () => {
		const obj = { a: { b: { c: { d: 'deep' } } } }
		const result = getNestedValue(obj, 'a.b.c.d')
		expect(result).toBe('deep')
	})

	it('gets array values', () => {
		const obj = { items: ['first', 'second', 'third'] }
		const result = getNestedValue(obj, 'items[1]')
		expect(result).toBe('second')
	})

	it('gets nested values within arrays', () => {
		const obj = { users: [{ name: 'John' }, { name: 'Jane' }] }
		const result = getNestedValue(obj, 'users[1].name')
		expect(result).toBe('Jane')
	})

	it('returns undefined for non-existent paths', () => {
		const obj = { name: 'John' }
		const result = getNestedValue(obj, 'nonexistent')
		expect(result).toBeUndefined()
	})

	it('returns undefined for non-existent nested paths', () => {
		const obj = { user: { name: 'John' } }
		const result = getNestedValue(obj, 'user.email')
		expect(result).toBeUndefined()
	})

	it('returns undefined for non-existent array indices', () => {
		const obj = { items: ['a', 'b'] }
		const result = getNestedValue(obj, 'items[5]')
		expect(result).toBeUndefined()
	})

	it('returns undefined when accessing array property on non-array', () => {
		const obj = { items: 'not an array' }
		const result = getNestedValue(obj, 'items[0]')
		expect(result).toBeUndefined()
	})

	it('handles null values in path', () => {
		const obj = { user: null }
		const result = getNestedValue(obj, 'user.name')
		expect(result).toBeUndefined()
	})
})

/*
 *   DELETE NESTED VALUE TESTS
 ***************************************************************************************************/
describe('deleteNestedValue', () => {
	it('deletes simple values', () => {
		const obj = { name: 'John', age: 30 }
		const result = deleteNestedValue(obj, 'name')
		expect(result).toEqual({ age: 30 })
	})

	it('deletes nested values', () => {
		const obj = { user: { name: 'John', email: 'john@example.com' } }
		const result = deleteNestedValue(obj, 'user.email')
		expect(result).toEqual({ user: { name: 'John' } })
	})

	it('removes array elements by splicing', () => {
		const obj = { items: ['a', 'b', 'c'] }
		const result = deleteNestedValue(obj, 'items[1]')
		expect(result).toEqual({ items: ['a', 'c'] })
	})

	it('removes nested array elements', () => {
		const obj = { users: [{ name: 'John' }, { name: 'Jane' }] }
		const result = deleteNestedValue(obj, 'users[0]')
		expect(result).toEqual({ users: [{ name: 'Jane' }] })
	})

	it('does not mutate original object', () => {
		const obj = { name: 'John', age: 30 }
		const result = deleteNestedValue(obj, 'name')
		expect(obj).toEqual({ name: 'John', age: 30 })
		expect(result).toEqual({ age: 30 })
	})

	it('returns same structure for empty path', () => {
		const obj = { test: 'value' }
		const result = deleteNestedValue(obj, '')
		expect(result).toEqual({ test: 'value' })
	})

	it('handles non-existent paths gracefully', () => {
		const obj = { name: 'John' }
		const result = deleteNestedValue(obj, 'nonexistent.path')
		expect(result).toEqual({ name: 'John' })
	})

	it('handles deleting from deeply nested arrays', () => {
		const obj = {
			form: {
				users: [{ addresses: [{ city: 'NYC' }, { city: 'LA' }] }],
			},
		}
		const result = deleteNestedValue(obj, 'form.users[0].addresses[0]')
		expect(result).toEqual({
			form: {
				users: [{ addresses: [{ city: 'LA' }] }],
			},
		})
	})
})
