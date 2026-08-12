/*
 *   IMPORTS
 ***************************************************************************************************/
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DriftStore } from '../store'
import type { DriftFormState, DriftState } from '../types'

/*
 *   TEST SETUP
 ***************************************************************************************************/
const PERSIST_KEY = 'drift-form-state'

function emptyForm(): DriftFormState {
	return {
		values: {},
		errors: {},
		touched: {},
		dirty: {},
		isValid: true,
		isSubmitting: false,
		isValidating: false,
		initialValues: {},
		hasBeenValidated: false,
		canSubmit: false,
		validatingFields: {},
	}
}

function stateWith(...keys: string[]): DriftState {
	const forms: Record<string, DriftFormState> = {}
	for (const key of keys) forms[key] = emptyForm()
	return { forms }
}

let store: DriftStore

beforeEach(() => {
	localStorage.clear()
	store = new DriftStore({ initialState: stateWith('login', 'signup') })
})

afterEach(() => {
	store.destroy()
	vi.useRealTimers()
})

/*
 *   READING AND WRITING TESTS
 ***************************************************************************************************/
describe('DriftStore - Reading and writing', () => {
	it('applies a recipe to the state', () => {
		store.mutate(draft => {
			draft.forms.login.values.email = 'a@b.com'
		})

		expect(store.getState().forms.login.values.email).toBe('a@b.com')
	})

	it('leaves the previous state alone', () => {
		const before = store.getState()

		store.mutate(draft => {
			draft.forms.login.touched.email = true
		})

		expect(before.forms.login.touched).toEqual({})
		expect(store.getState()).not.toBe(before)
	})

	it('adds a form the recipe puts there', () => {
		store.mutate(draft => {
			draft.forms.profile = emptyForm()
		})

		expect(Object.keys(store.getState().forms)).toEqual(['login', 'signup', 'profile'])
	})

	it('replaces a form the recipe assigns over', () => {
		const replacement = emptyForm()

		store.mutate(draft => {
			draft.forms.login = replacement
		})

		expect(store.getState().forms.login).toBe(replacement)
	})

	it('reports a missing form as undefined without inventing one', () => {
		store.mutate(draft => {
			expect(draft.forms.nothing).toBeUndefined()
		})

		expect('nothing' in store.getState().forms).toBe(false)
	})
})

/*
 *   STRUCTURAL SHARING TESTS
 ***************************************************************************************************/
describe('DriftStore - Structural sharing', () => {
	it('hands back the same object for a form the recipe never touched', () => {
		const before = store.getState().forms.signup

		store.mutate(draft => {
			draft.forms.login.dirty.email = true
		})

		expect(store.getState().forms.signup).toBe(before)
	})

	it('copies the form the recipe reached for', () => {
		const before = store.getState().forms.login

		store.mutate(draft => {
			draft.forms.login.dirty.email = true
		})

		expect(store.getState().forms.login).not.toBe(before)
		expect(before.dirty).toEqual({})
	})

	it('copies the records under a form rather than sharing them', () => {
		const before = store.getState().forms.login

		store.mutate(draft => {
			draft.forms.login.errors.email = ['Required']
		})

		const after = store.getState().forms.login

		expect(after.errors).not.toBe(before.errors)
		expect(after.values).not.toBe(before.values)
		expect(before.errors).toEqual({})
	})

	it('survives a recipe that changes nothing', () => {
		const before = store.getState()

		store.mutate(() => {})

		expect(store.getState().forms.login).toBe(before.forms.login)
		expect(store.getState().forms.signup).toBe(before.forms.signup)
	})
})

/*
 *   SUBSCRIPTION TESTS
 ***************************************************************************************************/
describe('DriftStore - Subscriptions', () => {
	it('tells subscribers about the state a mutation produced', () => {
		const listener = vi.fn()
		store.subscribe(listener)

		store.mutate(draft => {
			draft.forms.login.isSubmitting = true
		})

		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener.mock.calls[0][0]).toBe(store.getState())
	})

	it('stops telling a subscriber that unsubscribed', () => {
		const listener = vi.fn()
		const unsubscribe = store.subscribe(listener)

		unsubscribe()
		store.mutate(draft => {
			draft.forms.login.isSubmitting = true
		})

		expect(listener).not.toHaveBeenCalled()
	})

	it('keeps going when one subscriber throws', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const second = vi.fn()

		store.subscribe(() => {
			throw new Error('subscriber blew up')
		})
		store.subscribe(second)

		store.mutate(draft => {
			draft.forms.login.isSubmitting = true
		})

		expect(second).toHaveBeenCalledTimes(1)
		expect(error).toHaveBeenCalled()

		error.mockRestore()
	})

	it('drops every subscriber when destroyed', () => {
		const listener = vi.fn()
		store.subscribe(listener)

		store.destroy()
		store.mutate(draft => {
			draft.forms.login.isSubmitting = true
		})

		expect(listener).not.toHaveBeenCalled()
	})
})

/*
 *   PERSISTENCE TESTS
 ***************************************************************************************************/
describe('DriftStore - Persistence', () => {
	it('writes nothing without a key', () => {
		vi.useFakeTimers()

		store.mutate(draft => {
			draft.forms.login.values.email = 'a@b.com'
		})
		vi.runAllTimers()

		expect(localStorage.getItem(PERSIST_KEY)).toBeNull()
	})

	it('writes after the quiet period, once', () => {
		vi.useFakeTimers()
		const persisted = new DriftStore({
			initialState: stateWith('login'),
			persistKey: PERSIST_KEY,
			persistDelay: 50,
		})

		persisted.mutate(draft => {
			draft.forms.login.values.email = 'a@b.com'
		})
		persisted.mutate(draft => {
			draft.forms.login.values.email = 'c@d.com'
		})

		expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

		vi.advanceTimersByTime(50)

		const stored = JSON.parse(localStorage.getItem(PERSIST_KEY) as string) as DriftState
		expect(stored.forms.login.values.email).toBe('c@d.com')

		persisted.destroy()
	})

	it('writes on demand when flushed', () => {
		const persisted = new DriftStore({
			initialState: stateWith('login'),
			persistKey: PERSIST_KEY,
		})

		persisted.mutate(draft => {
			draft.forms.login.values.email = 'a@b.com'
		})
		persisted.flush()

		expect(localStorage.getItem(PERSIST_KEY)).toContain('a@b.com')

		persisted.destroy()
	})

	it('reads what a previous session left behind', () => {
		localStorage.setItem(
			PERSIST_KEY,
			JSON.stringify({ forms: { login: { ...emptyForm(), values: { email: 'a@b.com' } } } }),
		)

		const persisted = new DriftStore({
			initialState: { forms: {} },
			persistKey: PERSIST_KEY,
		})

		expect(persisted.getState().forms.login.values.email).toBe('a@b.com')

		persisted.destroy()
	})

	it('starts fresh when what is stored is not what it wrote', () => {
		localStorage.setItem(PERSIST_KEY, 'not json at all')

		const persisted = new DriftStore({
			initialState: stateWith('login'),
			persistKey: PERSIST_KEY,
		})

		expect(Object.keys(persisted.getState().forms)).toEqual(['login'])

		persisted.destroy()
	})

	it('ignores stored json of the wrong shape', () => {
		localStorage.setItem(PERSIST_KEY, JSON.stringify({ forms: null }))

		const persisted = new DriftStore({
			initialState: stateWith('login'),
			persistKey: PERSIST_KEY,
		})

		expect(Object.keys(persisted.getState().forms)).toEqual(['login'])

		persisted.destroy()
	})

	it('keeps working when storage refuses the write', () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError')
		})

		const persisted = new DriftStore({
			initialState: stateWith('login'),
			persistKey: PERSIST_KEY,
		})

		expect(() => {
			persisted.mutate(draft => {
				draft.forms.login.values.email = 'a@b.com'
			})
			persisted.flush()
		}).not.toThrow()

		expect(persisted.getState().forms.login.values.email).toBe('a@b.com')

		setItem.mockRestore()
		persisted.destroy()
	})
})
