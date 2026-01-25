/*
 *   TYPES
 ***************************************************************************************************/
interface PathSegment {
	key: string
	isArray: boolean
	index?: number
}

/*
 *   CACHE
 ***************************************************************************************************/
const pathCache = new Map<string, PathSegment[]>()

/*
 *   PATH PARSING
 ***************************************************************************************************/
/**
 * Parse a field name into path segments for nested value access
 */
export function parseFieldName(fieldName: string): PathSegment[] {
	const cached = pathCache.get(fieldName)
	if (cached) {
		return cached
	}

	const segments: PathSegment[] = []
	const regex = /([^.[]+)|\[(\d+)\]/g
	let match: RegExpExecArray | null
	let pendingKey: string | null = null

	while ((match = regex.exec(fieldName)) !== null) {
		if (match[1] !== undefined) {
			if (pendingKey !== null) {
				segments.push({ key: pendingKey, isArray: false })
			}
			pendingKey = match[1]
		} else if (match[2] !== undefined) {
			if (pendingKey !== null) {
				segments.push({ key: pendingKey, isArray: true, index: parseInt(match[2], 10) })
				pendingKey = null
			}
		}
	}

	if (pendingKey !== null) {
		segments.push({ key: pendingKey, isArray: false })
	}

	pathCache.set(fieldName, segments)
	return segments
}

/*
 *   VALUE OPERATIONS
 ***************************************************************************************************/
/**
 * Set a value at a specific path in an object
 */
export function setValueByPath(
	obj: Record<string, unknown>,
	path: PathSegment[],
	value: unknown
): Record<string, unknown> {
	if (path.length === 0) {
		return obj
	}

	const result = { ...obj }
	let current: Record<string, unknown> = result

	for (let i = 0; i < path.length; i++) {
		const segment = path[i]
		const isLast = i === path.length - 1

		if (segment.isArray) {
			if (!Array.isArray(current[segment.key])) {
				current[segment.key] = []
			}

			const arr = [...(current[segment.key] as unknown[])]
			current[segment.key] = arr

			if (isLast) {
				arr[segment.index!] = value
			} else {
				if (arr[segment.index!] === undefined || typeof arr[segment.index!] !== 'object') {
					arr[segment.index!] = {}
				}
				arr[segment.index!] = { ...(arr[segment.index!] as Record<string, unknown>) }
				current = arr[segment.index!] as Record<string, unknown>
			}
		} else {
			if (isLast) {
				current[segment.key] = value
			} else {
				if (
					current[segment.key] === undefined ||
					typeof current[segment.key] !== 'object'
				) {
					current[segment.key] = {}
				}
				current[segment.key] = { ...(current[segment.key] as Record<string, unknown>) }
				current = current[segment.key] as Record<string, unknown>
			}
		}
	}

	return result
}

/**
 * Get a value at a specific path in an object
 */
export function getValueByPath(obj: Record<string, unknown>, path: PathSegment[]): unknown {
	let current: unknown = obj

	for (const segment of path) {
		if (current === undefined || current === null) {
			return undefined
		}

		if (segment.isArray) {
			const arr = (current as Record<string, unknown>)[segment.key]
			if (!Array.isArray(arr)) {
				return undefined
			}
			current = arr[segment.index!]
		} else {
			current = (current as Record<string, unknown>)[segment.key]
		}
	}

	return current
}

/**
 * Set a nested value using a field name path
 */
export function setNestedValue(
	obj: Record<string, unknown>,
	fieldName: string,
	value: unknown
): Record<string, unknown> {
	const path = parseFieldName(fieldName)
	return setValueByPath(obj, path, value)
}

/**
 * Get a nested value using a field name path
 */
export function getNestedValue(obj: Record<string, unknown>, fieldName: string): unknown {
	const path = parseFieldName(fieldName)
	return getValueByPath(obj, path)
}

/**
 * Delete a nested value using a field name path
 */
export function deleteNestedValue(
	obj: Record<string, unknown>,
	fieldName: string
): Record<string, unknown> {
	const path = parseFieldName(fieldName)
	if (path.length === 0) {
		return obj
	}

	const result = { ...obj }

	if (path.length === 1) {
		const segment = path[0]
		if (segment.isArray) {
			const arr = result[segment.key]
			if (Array.isArray(arr)) {
				const newArr = [...arr]
				newArr.splice(segment.index!, 1)
				result[segment.key] = newArr
			}
		} else {
			delete result[segment.key]
		}
		return result
	}

	let current: Record<string, unknown> = result
	for (let i = 0; i < path.length - 1; i++) {
		const segment = path[i]

		if (segment.isArray) {
			if (!Array.isArray(current[segment.key])) {
				return result
			}
			const arr = [...(current[segment.key] as unknown[])]
			current[segment.key] = arr
			if (arr[segment.index!] === undefined) {
				return result
			}
			arr[segment.index!] = { ...(arr[segment.index!] as Record<string, unknown>) }
			current = arr[segment.index!] as Record<string, unknown>
		} else {
			if (typeof current[segment.key] !== 'object') {
				return result
			}
			current[segment.key] = { ...(current[segment.key] as Record<string, unknown>) }
			current = current[segment.key] as Record<string, unknown>
		}
	}

	const lastSegment = path[path.length - 1]
	if (lastSegment.isArray) {
		const arr = current[lastSegment.key]
		if (Array.isArray(arr)) {
			const newArr = [...arr]
			newArr.splice(lastSegment.index!, 1)
			current[lastSegment.key] = newArr
		}
	} else {
		delete current[lastSegment.key]
	}

	return result
}
