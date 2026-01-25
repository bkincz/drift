# Drift

[![Release](https://github.com/bkincz/drift/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/bkincz/drift/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/bkincz/drift/branch/main/graph/badge.svg)](https://codecov.io/gh/bkincz/drift)
[![npm version](https://badge.fury.io/js/@bkincz%2Fdrift.svg)](https://badge.fury.io/js/@bkincz%2Fdrift)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A DOM-driven form library that automatically tracks forms and fields based on their presence in the DOM.

```bash
npm install @bkincz/drift
```

## Quick Start

```html
<form data-drift-form="login">
  <input name="email" type="email" />
  <input name="password" type="password" />
  <button type="submit">Login</button>
</form>
```

```typescript
import { Drift } from '@bkincz/drift'

const drift = new Drift()
drift.observe(document.body)

// Subscribe to form state
drift.subscribe('login', (state) => {
  console.log('Values:', state.values)
  console.log('Errors:', state.errors)
})

// Handle submission
drift.onSubmit('login', async (values) => {
  await api.login(values)
})
```

## Core Features

### Automatic Registration

Forms and fields are tracked automatically based on DOM presence.

```html
<!-- Field in DOM = registered -->
<input name="email" />

<!-- Field removed from DOM = unregistered (value preserved) -->

<!-- Field excluded from tracking -->
<input name="secret" data-drift-hidden />
```

### Nested Fields

Dot notation and array notation are supported.

```html
<input name="user.address.city" />
<input name="items[0].name" />
<input name="items[1].name" />
```

Resolves to:

```typescript
{
  user: { address: { city: '...' } },
  items: [{ name: '...' }, { name: '...' }]
}
```

### Schema Validation

Register schemas with configurable validation timing.

```typescript
drift.registerSchema('signup', {
  // Form-level validation (runs on submit)
  validate: async (values) => {
    const result = schema.safeParse(values)
    return {
      success: result.success,
      errors: result.error?.flatten().fieldErrors
    }
  },

  // Field-level validation with timing
  fields: {
    email: {
      validate: (value) => ({
        success: isEmail(value),
        errors: isEmail(value) ? undefined : { email: ['Invalid email'] }
      }),
      validateOn: { debounce: 300 }  // 'blur' | 'change' | { debounce: ms }
    },
    password: {
      validate: (value) => ({
        success: value.length >= 8,
        errors: value.length >= 8 ? undefined : { password: ['Min 8 characters'] }
      }),
      validateOn: 'blur'
    }
  }
})
```

### State Persistence

Values are remembered when fields are removed and re-added.

```typescript
// Field removed from DOM -> value kept in state
// Field re-added with empty value -> previous value restored
// Field re-added with new value -> new value used
```

## API Reference

### Configuration

```typescript
const drift = new Drift({
  formAttribute: 'data-drift-form',    // form identifier attribute
  hiddenAttribute: 'data-drift-hidden', // exclude fields from tracking
  persist: false,                       // localStorage persistence
  observerDebounce: 16                  // mutation observer debounce (ms)
})
```

### Core Methods

```typescript
drift.observe(element)                    // Start observing
drift.disconnect()                        // Stop observing

drift.registerSchema(formKey, schema)     // Register validation
drift.unregisterSchema(formKey)           // Remove validation

drift.getForm(formKey)                    // Get form state
drift.getValue(formKey, fieldName)        // Get field value
drift.setValue(formKey, fieldName, value) // Set field value
drift.setValues(formKey, values)          // Set multiple values

drift.getErrors(formKey, fieldName)       // Get field errors
drift.getAllErrors(formKey)               // Get all form errors
drift.setErrors(formKey, errors)          // Set errors
drift.clearErrors(formKey, fieldName?)    // Clear errors

drift.validateField(formKey, fieldName)   // Validate single field
drift.validateForm(formKey)               // Validate entire form
drift.submit(formKey)                     // Programmatic submit

drift.resetForm(formKey)                  // Reset to initial state
drift.isTouched(formKey, fieldName)       // Check if touched
drift.isDirty(formKey, fieldName)         // Check if dirty
drift.isFormDirty(formKey)                // Check if form is dirty
```

### Subscriptions

```typescript
// Subscribe to form state
const unsubscribe = drift.subscribe(formKey, (state) => {
  // state: { values, errors, touched, dirty, isValid, isSubmitting, isValidating }
})

// Subscribe to all forms
drift.subscribeAll((forms) => { ... })

// Subscribe to events
drift.on('field:change', (event) => { ... })
drift.on('form:register', (event) => { ... })
```

### Events

- `form:register` / `form:unregister`
- `field:register` / `field:unregister`
- `field:change` / `field:blur` / `field:focus`
- `validation:start` / `validation:end`
- `submit:start` / `submit:end`

## Performance

- **Lightweight**: ~20KB minified, ~5KB gzipped
- **Efficient observation**: Debounced MutationObserver
- **Minimal overhead**: Only tracks visible, named inputs

## TypeScript

Fully typed with exports for all interfaces.

```typescript
import type { DriftFormState, DriftSchema, ValidationResult } from '@bkincz/drift'
```

## License

MIT
