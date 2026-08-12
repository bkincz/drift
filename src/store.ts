/*
 *   IMPORTS
 ***************************************************************************************************/
import type { DriftFormState, DriftState } from './types'

/*
 *   TYPES
 ***************************************************************************************************/
export interface DriftStoreConfig {
	initialState: DriftState
	/** Where to persist, in localStorage. Left out, the state stays in memory. */
	persistKey?: string
	/** Quiet period after the last change before the state is written. */
	persistDelay?: number
}

export type DriftStoreListener = (state: DriftState) => void

/*
 *   CONSTANTS
 ***************************************************************************************************/
const DEFAULT_PERSIST_DELAY = 100

/*
 *   DRAFTING
 ***************************************************************************************************/
function cloneForm(form: DriftFormState): DriftFormState {
	return {
		...form,
		values: { ...form.values },
		errors: { ...form.errors },
		touched: { ...form.touched },
		dirty: { ...form.dirty },
		initialValues: { ...form.initialValues },
		validatingFields: { ...form.validatingFields },
	}
}

function createDraft(state: DriftState): {
	draft: DriftState
	commit: () => DriftState
} {
	const forms: Record<string, DriftFormState> = {}
	const pending = new Set(Object.keys(state.forms))

	const settle = (key: string, form: DriftFormState): DriftFormState => {
		pending.delete(key)

		Object.defineProperty(forms, key, {
			value: form,
			writable: true,
			enumerable: true,
			configurable: true,
		})

		return form
	}

	for (const key of pending) {
		Object.defineProperty(forms, key, {
			get: () => settle(key, cloneForm(state.forms[key])),
			set: (form: DriftFormState) => {
				settle(key, form)
			},
			enumerable: true,
			configurable: true,
		})
	}

	return {
		draft: { forms },
		commit: () => {
			// Untouched forms hand back their originals rather than a copy.
			for (const key of pending) {
				Object.defineProperty(forms, key, {
					value: state.forms[key],
					writable: true,
					enumerable: true,
					configurable: true,
				})
			}

			return { forms }
		},
	}
}

/*
 *   STORE
 ***************************************************************************************************/
export class DriftStore {
	private state: DriftState
	private listeners: Set<DriftStoreListener> = new Set()
	private readonly persistKey?: string
	private readonly persistDelay: number
	private persistTimer?: ReturnType<typeof setTimeout>

	constructor(config: DriftStoreConfig) {
		this.state = config.initialState
		this.persistKey = config.persistKey
		this.persistDelay = config.persistDelay ?? DEFAULT_PERSIST_DELAY

		this.hydrate()
	}

	/*
	 *   READING
	 ************************************************************************************************/
	getState(): DriftState {
		return this.state
	}

	subscribe(listener: DriftStoreListener): () => void {
		this.listeners.add(listener)

		return () => {
			this.listeners.delete(listener)
		}
	}

	/*
	 *   WRITING
	 ************************************************************************************************/
	mutate(recipe: (draft: DriftState) => void): void {
		const { draft, commit } = createDraft(this.state)

		recipe(draft)

		this.state = commit()

		this.notify()
		this.schedulePersist()
	}

	/*
	 *   LIFECYCLE
	 ************************************************************************************************/
	flush(): void {
		if (this.persistKey === undefined) return

		clearTimeout(this.persistTimer)
		this.persistTimer = undefined

		try {
			localStorage.setItem(this.persistKey, JSON.stringify(this.state))
		} catch {
			/* Quota, private mode, or no storage at all: the state stays in memory. */
		}
	}

	destroy(): void {
		this.flush()
		this.listeners.clear()
	}

	/*
	 *   PRIVATE
	 ************************************************************************************************/
	private notify(): void {
		for (const listener of [...this.listeners]) {
			try {
				listener(this.state)
			} catch (error) {
				console.error('[Drift] Subscriber error:', error)
			}
		}
	}

	private schedulePersist(): void {
		if (this.persistKey === undefined) return

		clearTimeout(this.persistTimer)
		this.persistTimer = setTimeout(() => this.flush(), this.persistDelay)
	}

	private hydrate(): void {
		if (this.persistKey === undefined) return

		try {
			const stored = localStorage.getItem(this.persistKey)
			if (stored === null) return

			const parsed: unknown = JSON.parse(stored)

			if (
				typeof parsed === 'object' &&
				parsed !== null &&
				'forms' in parsed &&
				typeof parsed.forms === 'object' &&
				parsed.forms !== null
			) {
				this.state = { forms: parsed.forms as Record<string, DriftFormState> }
			}
		} catch {
			/* Unreadable or unavailable storage: start from the initial state. */
		}
	}
}
