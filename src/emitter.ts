/*
 *   EVENT EMITTER
 ***************************************************************************************************/
import type { DriftEvent, DriftEventListener } from './types'

export class DriftEventEmitter {
	private eventListeners: Map<string, Set<DriftEventListener>> = new Map()

	on(event: string, listener: DriftEventListener): () => void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set())
		}
		this.eventListeners.get(event)!.add(listener)
		return () => this.eventListeners.get(event)?.delete(listener)
	}

	off(event: string, listener: DriftEventListener): void {
		this.eventListeners.get(event)?.delete(listener)
	}

	emit(event: DriftEvent): void {
		const listeners = this.eventListeners.get(event.type)
		if (listeners) {
			for (const listener of listeners) {
				listener(event)
			}
		}

		const wildcardListeners = this.eventListeners.get('*')
		if (wildcardListeners) {
			for (const listener of wildcardListeners) {
				listener(event)
			}
		}
	}
}
