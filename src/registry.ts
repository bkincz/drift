/*
 *   IMPORTS
 ***************************************************************************************************/
import type { DriftSchema, ValidationResult, DriftFieldSchema } from './types'

/*
 *   SCHEMA REGISTRY CLASS
 ***************************************************************************************************/
/**
 * Registry for managing form validation schemas
 */
export class SchemaRegistry {
	private schemas: Map<string, DriftSchema> = new Map()

	/**
	 * Register a schema for a form
	 */
	register(formKey: string, schema: DriftSchema): void {
		this.schemas.set(formKey, schema)
	}

	/**
	 * Unregister a schema for a form
	 */
	unregister(formKey: string): void {
		this.schemas.delete(formKey)
	}

	/**
	 * Get a schema by form key
	 */
	get(formKey: string): DriftSchema | undefined {
		return this.schemas.get(formKey)
	}

	/**
	 * Check if a schema exists for a form
	 */
	has(formKey: string): boolean {
		return this.schemas.has(formKey)
	}

	/**
	 * Get all registered form keys
	 */
	keys(): string[] {
		return Array.from(this.schemas.keys())
	}

	/**
	 * Clear all registered schemas
	 */
	clear(): void {
		this.schemas.clear()
	}

	/**
	 * Validate a single field using its schema
	 */
	async validateField(
		formKey: string,
		fieldName: string,
		value: unknown,
		allValues: Record<string, unknown>
	): Promise<ValidationResult> {
		const schema = this.schemas.get(formKey)
		if (!schema?.fields?.[fieldName]) {
			return { success: true }
		}

		const fieldSchema = schema.fields[fieldName]
		return await fieldSchema.validate(value, allValues)
	}

	/**
	 * Validate an entire form using its schema
	 */
	async validateForm(
		formKey: string,
		values: Record<string, unknown>
	): Promise<ValidationResult> {
		const schema = this.schemas.get(formKey)
		if (!schema?.validate) {
			return { success: true }
		}

		return await schema.validate(values)
	}

	/**
	 * Get the schema for a specific field
	 */
	getFieldSchema(formKey: string, fieldName: string): DriftFieldSchema | undefined {
		const schema = this.schemas.get(formKey)
		return schema?.fields?.[fieldName]
	}

	/**
	 * Check if a field has a schema
	 */
	hasFieldSchema(formKey: string, fieldName: string): boolean {
		const schema = this.schemas.get(formKey)
		return schema?.fields?.[fieldName] !== undefined
	}
}
