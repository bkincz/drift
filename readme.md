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

> **Note:** `data-drift-form` works on any element, not just `<form>`. Use a `<div>` or other container when a native form element would conflict (e.g. nested inside an existing `<form>`).
>
> ```html
> <div data-drift-form="checkout">
>   <input name="card_number" />
> </div>
> ```

```typescript
import { Drift } from '@bkincz/drift'

const drift = new Drift()
drift.observe(document.body)

// Subscribe to form state
drift.subscribe('login', (state) => {
  console.log('Values:', state.values)
  console.log('Errors:', state.errors)
  console.log('Can submit:', state.canSubmit)
})

// Handle submission
drift.onSubmit('login', async (values) => {
  await api.login(values)
})
```

## Core Features

### Automatic Registration

Forms and fields are tracked automatically based on DOM presence. The `data-drift-form` attribute can be placed on any element — `<form>`, `<div>`, `<section>`, etc.

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

Register schemas with configurable validation timing. `validateOn` is optional per field — set a form-wide default via config instead.

```typescript
const drift = new Drift({ defaultValidateOn: 'blur' })

drift.registerSchema('signup', {
  // Form-level validation (runs on submit)
  validate: async (values) => {
    const result = schema.safeParse(values)
    return {
      success: result.success,
      errors: result.error?.flatten().fieldErrors
    }
  },

  // Field-level validation with optional timing override
  fields: {
    email: {
      validate: (value) => ({
        success: isEmail(value),
        errors: isEmail(value) ? undefined : { email: ['Invalid email'] }
      }),
      validateOn: { debounce: 300 }  // 'blur' | 'change' | { debounce: ms }
    },
    username: {
      validate: (value) => ({ ... }),
      transform: (value) => String(value).trim().toLowerCase()  // coerce before storing
    }
  }
})
```

Fields with active errors revalidate on any value change, including programmatic updates from JavaScript. This means linked fields — where one field's value is derived from another — will clear their errors automatically without any extra wiring.

A field validator may return errors for other fields. This is useful for cross-field rules like password confirmation:

```typescript
fields: {
  password: {
    validate: (value, all) => value !== all.confirm
      ? { success: false, errors: {
          password: ['Passwords do not match'],
          confirm:  ['Passwords do not match'],
        }}
      : { success: true }
  }
}
```

### Initial Values

Seed a form with data — useful for edit forms. Fields seeded this way are not considered dirty, and `resetForm` restores to these values.

```typescript
drift.setInitialValues('profile', {
  name: 'Alice',
  email: 'alice@example.com',
})

// Later, user makes changes and wants to cancel
await drift.resetForm('profile')  // restores name + email, clears errors/dirty/touched
```

### Reset Handler

Hook into the reset lifecycle to clear server-side state or UI that Drift doesn't own.

```typescript
drift.onReset('profile', async () => {
  await api.clearDraft()
})
```

A `<button type="reset">` inside the form automatically triggers `resetForm`.

### Radio Groups

Radio inputs sharing a `name` are automatically treated as a single logical field.

```html
<form data-drift-form="survey">
  <input type="radio" name="size" value="sm" />
  <input type="radio" name="size" value="lg" />
</form>
```

```typescript
drift.getValue('survey', 'size')        // 'sm' | 'lg' | undefined
drift.setValue('survey', 'size', 'lg')  // checks the matching radio
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
  observerDebounce: 16,                 // mutation observer debounce (ms)
  defaultValidateOn: 'blur',            // fallback trigger for fields without validateOn
})
```

### Core Methods

```typescript
drift.observe(element)                         // Start observing
drift.disconnect()                             // Stop observing

drift.registerSchema(formKey, schema)          // Register validation
drift.unregisterSchema(formKey)                // Remove validation

drift.getForm(formKey)                         // Get form state
drift.getValue(formKey, fieldName)             // Get field value
drift.setValue(formKey, fieldName, value)      // Set field value
drift.setValues(formKey, values)               // Set multiple values
drift.setInitialValues(formKey, values)        // Seed initial values (not dirty)

drift.getErrors(formKey, fieldName)            // Get field errors
drift.getAllErrors(formKey)                    // Get all form errors
drift.setErrors(formKey, errors)               // Set errors
drift.clearErrors(formKey, fieldName?)         // Clear errors

drift.validateField(formKey, fieldName)        // Validate single field
drift.validateForm(formKey)                    // Validate entire form
drift.submit(formKey)                          // Programmatic submit

drift.resetForm(formKey)                       // Reset to initial state (async)
drift.isTouched(formKey, fieldName)            // Check if touched
drift.isDirty(formKey, fieldName)              // Check if dirty
drift.isFormDirty(formKey)                     // Check if form is dirty
```

### Handlers

```typescript
drift.onSubmit(formKey, async (values) => { ... })   // returns unsubscribe fn
drift.onReset(formKey, async () => { ... })          // returns unsubscribe fn
```

### Subscriptions

```typescript
// Subscribe to form state
const unsubscribe = drift.subscribe(formKey, (state) => {
  // state: { values, errors, touched, dirty, isValid, isSubmitting, isValidating,
  //          initialValues, hasBeenValidated, canSubmit, validatingFields }
})

// Subscribe to all forms
drift.subscribeAll((forms) => { ... })

// Subscribe to events
drift.on('field:change', (event) => { ... })
drift.on('form:register', (event) => { ... })
```

### Form State

| Property | Type | Description |
|---|---|---|
| `values` | `Record<string, unknown>` | Current field values |
| `errors` | `Record<string, string[]>` | Active validation errors |
| `touched` | `Record<string, boolean>` | Fields that have been blurred |
| `dirty` | `Record<string, boolean>` | Fields that have been changed |
| `isValid` | `boolean` | No active errors |
| `isSubmitting` | `boolean` | Submit in progress |
| `isValidating` | `boolean` | Form-level validation in progress |
| `validatingFields` | `Record<string, boolean>` | Per-field validation in progress |
| `initialValues` | `Record<string, unknown>` | Values set via `setInitialValues` |
| `hasBeenValidated` | `boolean` | Form has been validated at least once |
| `canSubmit` | `boolean` | `hasBeenValidated && isValid` |

### Events

- `form:register` / `form:unregister` / `form:reset`
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
import type {
  DriftFormState,
  DriftSchema,
  DriftFieldSchema,
  DriftResetHandler,
  ValidationResult,
} from '@bkincz/drift'
```

## License

MIT
