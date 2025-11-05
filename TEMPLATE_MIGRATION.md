# Template Migration: Pug → @kitajs/html

## Recommendation: @kitajs/html

Migrate from Pug templates to `@kitajs/html` for a functional, type-safe templating solution.

## Why @kitajs/html?

### Advantages over Pug

| Feature | Pug | @kitajs/html |
|---------|-----|--------------|
| Type Safety | ❌ No | ✅ Full TypeScript |
| Autocomplete | ❌ No | ✅ Yes (JSX) |
| Refactoring | ❌ Hard | ✅ Easy (IDE support) |
| Learning Curve | ⚠️ Custom DSL | ✅ JSX (familiar) |
| Performance | ⚠️ Runtime | ✅ Compile-time |
| Functional | ❌ Imperative | ✅ Pure functions |
| Effect Integration | ❌ Poor | ✅ Natural |
| Testing | ❌ Hard | ✅ Easy (unit test functions) |
| Bundle Size | ⚠️ Large | ✅ Zero runtime |

### Fits Your Architecture

- **Pure Functions**: Templates are just TypeScript functions
- **Composable**: Easy to create reusable components
- **Type-Safe**: Props are typed interfaces
- **Effect-Compatible**: Can use Effect in component logic
- **Testable**: Unit test templates like any function

## Installation

```bash
npm install --save @kitajs/html
npm install --save-dev @kitajs/ts-html-plugin
```

## Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "Html.createElement",
    "jsxFragmentFactory": "Html.Fragment",
    "plugins": [{ "name": "@kitajs/ts-html-plugin" }]
  }
}
```

## Migration Examples

### Example 1: Layout

**Before (layout.pug):**
```pug
doctype html
html
  head
    title= title
  body
    block content
```

**After (layout.tsx):**
```tsx
import Html from '@kitajs/html'

interface LayoutProps {
  title: string
  children: string
}

export function Layout({ title, children }: LayoutProps) {
  return (
    <html>
      <head>
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Example 2: Login Page

**Before (login.pug):**
```pug
extends layout

block content
    h1(id="login-title") Please log in
    if error
        p.
            #{error}
    form(action=action, method="POST")
        input(type="hidden", name=envXsrfToken, value=csrfToken)
        input(type="hidden", name="challenge", value=challenge)
        table
            tr
                td
                    input(type="email", id="email", name="email", value=hint)
                td (it's "foo@bar.com")
        input(type="submit", id="accept", value="Log in")
```

**After (login.tsx):**
```tsx
import Html from '@kitajs/html'
import { Layout } from './layout'

interface LoginPageProps {
  title: string
  action: string
  challenge: string
  csrfToken: string
  envXsrfToken: string
  hint?: string
  error?: string
}

export function LoginPage(props: LoginPageProps) {
  return (
    <Layout title={props.title}>
      <h1 id="login-title">Please log in</h1>

      {props.error && <p>{props.error}</p>}

      <form action={props.action} method="POST">
        <input type="hidden" name={props.envXsrfToken} value={props.csrfToken} />
        <input type="hidden" name="challenge" value={props.challenge} />

        <table>
          <tr>
            <td>
              <input
                type="email"
                id="email"
                name="email"
                value={props.hint}
                placeholder="email@foobar.com"
              />
            </td>
            <td>(it's "foo@bar.com")</td>
          </tr>
          <tr>
            <td>
              <input type="password" id="password" name="password" />
            </td>
            <td>(it's "foobar")</td>
          </tr>
        </table>

        <input type="checkbox" id="remember" name="remember" value="1" />
        <label for="remember">Remember me</label>
        <br />

        <input type="submit" id="accept" name="submit" value="Log in" />
        <input type="submit" id="reject" name="submit" value="Deny access" />
      </form>
    </Layout>
  )
}
```

### Example 3: Consent Page (with iteration)

**Before (consent.pug):**
```pug
extends layout

block content
    h1 An application requests access to your data!
    form(action=action, method="POST")
        p Hi #{user}, application <strong>#{client.client_name}</strong> wants access

        each scope in requested_scope
            input(type="checkbox", id=scope, value=scope, name="grant_scope")
            label(for=scope) #{scope}
            br
```

**After (consent.tsx):**
```tsx
import Html from '@kitajs/html'
import { Layout } from './layout'

interface ConsentPageProps {
  title: string
  action: string
  challenge: string
  csrfToken: string
  envXsrfToken: string
  user: string
  client: {
    client_id: string
    client_name?: string
    logo_uri?: string
    policy_uri?: string
    tos_uri?: string
  }
  requested_scope: string[]
}

export function ConsentPage(props: ConsentPageProps) {
  const clientName = props.client.client_name || props.client.client_id

  return (
    <Layout title={props.title}>
      <h1>An application requests access to your data!</h1>

      <form action={props.action} method="POST">
        <input type="hidden" name="challenge" value={props.challenge} />
        <input type="hidden" name={props.envXsrfToken} value={props.csrfToken} />

        {props.client.logo_uri && (
          <img src={props.client.logo_uri} alt="Client logo" />
        )}

        <p>
          Hi {props.user}, application <strong>{clientName}</strong> wants
          access to resources on your behalf and to:
        </p>

        {props.requested_scope.map(scope => (
          <>
            <input
              type="checkbox"
              class="grant_scope"
              id={scope}
              value={scope}
              name="grant_scope"
            />
            <label for={scope}>{scope}</label>
            <br />
          </>
        ))}

        <p>
          Do you want to be asked next time when this application wants to
          access your data?
        </p>

        <ul>
          {props.client.policy_uri && (
            <li><a href={props.client.policy_uri}>Policy</a></li>
          )}
          {props.client.tos_uri && (
            <li><a href={props.client.tos_uri}>Terms of Service</a></li>
          )}
        </ul>

        <p>
          <input type="checkbox" id="remember" name="remember" value="1" />
          <label for="remember">Do not ask me again</label>
        </p>

        <p>
          <input type="submit" id="accept" name="submit" value="Allow access" />
          <input type="submit" id="reject" name="submit" value="Deny access" />
        </p>
      </form>
    </Layout>
  )
}
```

## Usage in Routes

### Before (with Pug)

```typescript
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login',
    action: '/login',
    challenge: req.query.login_challenge,
    // ...
  })
})
```

### After (with @kitajs/html)

```typescript
import { LoginPage } from '../views/login'

app.get('/login', (req, res) => {
  const html = LoginPage({
    title: 'Login',
    action: '/login',
    challenge: req.query.login_challenge as string,
    csrfToken: req.csrfToken(),
    envXsrfToken: 'X-CSRF-TOKEN',
    hint: req.query.hint as string,
  })

  res.type('html').send('<!DOCTYPE html>' + html)
})
```

### With Effect (Functional)

```typescript
import { Effect } from 'effect'
import { LoginPage } from '../views/login'

const renderLoginPage = (props: LoginPageProps): Effect.Effect<string, never> =>
  Effect.succeed('<!DOCTYPE html>' + LoginPage(props))

// In route handler
const program = Effect.gen(function* () {
  const props: LoginPageProps = {
    title: 'Login',
    action: '/login',
    challenge: req.query.login_challenge as string,
    csrfToken: req.csrfToken(),
    envXsrfToken: 'X-CSRF-TOKEN',
  }

  const html = yield* renderLoginPage(props)
  return html
})

const html = await Effect.runPromise(program)
res.type('html').send(html)
```

## Advanced: Composable Components

Create reusable components:

```tsx
// components/Form.tsx
interface FormProps {
  action: string
  method: 'GET' | 'POST'
  csrfToken?: string
  csrfField?: string
  children: string
}

export function Form(props: FormProps) {
  return (
    <form action={props.action} method={props.method}>
      {props.csrfToken && props.csrfField && (
        <input type="hidden" name={props.csrfField} value={props.csrfToken} />
      )}
      {props.children}
    </form>
  )
}

// components/Button.tsx
interface ButtonProps {
  type: 'submit' | 'button' | 'reset'
  id?: string
  name?: string
  value?: string
  children: string
}

export function Button(props: ButtonProps) {
  return (
    <button
      type={props.type}
      id={props.id}
      name={props.name}
      value={props.value}
    >
      {props.children}
    </button>
  )
}

// Use in templates
<Form action="/login" method="POST" csrfToken={token} csrfField="csrf">
  <Button type="submit" id="accept" value="login">
    Log In
  </Button>
</Form>
```

## Testing

Templates become testable pure functions:

```typescript
import { describe, it, expect } from 'vitest'
import { LoginPage } from './login'

describe('LoginPage', () => {
  it('should render login form', () => {
    const html = LoginPage({
      title: 'Login',
      action: '/login',
      challenge: 'test-challenge',
      csrfToken: 'test-token',
      envXsrfToken: 'X-CSRF-TOKEN',
    })

    expect(html).toContain('<h1 id="login-title">Please log in</h1>')
    expect(html).toContain('value="test-challenge"')
    expect(html).toContain('value="test-token"')
  })

  it('should display error message when provided', () => {
    const html = LoginPage({
      title: 'Login',
      action: '/login',
      challenge: 'test',
      csrfToken: 'token',
      envXsrfToken: 'X-CSRF-TOKEN',
      error: 'Invalid credentials',
    })

    expect(html).toContain('<p>Invalid credentials</p>')
  })
})
```

## Migration Strategy

### Phase 1: Setup (1 hour)
1. Install @kitajs/html
2. Configure TypeScript for JSX
3. Create `views/` directory for TSX files
4. Create base Layout component

### Phase 2: Migrate Templates (4-6 hours)
1. Start with simple templates (layout, error)
2. Migrate forms (login, consent, logout)
3. Migrate complex templates (device flow)
4. Create shared components

### Phase 3: Update Routes (2-3 hours)
1. Replace `res.render()` with function calls
2. Update to use typed props
3. Test each route

### Phase 4: Cleanup (1 hour)
1. Remove Pug dependency
2. Delete old `.pug` files
3. Update documentation

**Total: ~8-11 hours**

## File Structure

```
src/
├── views/
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Form.tsx
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── login.tsx
│   ├── consent.tsx
│   ├── logout.tsx
│   ├── callback.tsx
│   ├── error.tsx
│   ├── device/
│   │   ├── verify.tsx
│   │   └── success.tsx
│   └── index.tsx
└── routes/
    ├── login-fp.ts (uses LoginPage)
    ├── consent-fp.ts (uses ConsentPage)
    └── ...
```

## Alternative: htm (if you prefer template strings)

If you don't want JSX, consider `htm`:

```typescript
import htm from 'htm'
import vhtml from 'vhtml'

const html = htm.bind(vhtml)

export function LoginPage(props: LoginPageProps) {
  return html`
    <html>
      <head><title>${props.title}</title></head>
      <body>
        <h1>Please log in</h1>
        ${props.error && html`<p>${props.error}</p>`}
      </body>
    </html>
  `
}
```

But @kitajs/html is recommended for better TypeScript integration.

## Benefits Summary

✅ **Type Safety** - Catch errors at compile time
✅ **Better DX** - Autocomplete, refactoring, jump-to-definition
✅ **Functional** - Pure functions, easy to test
✅ **Fast** - No runtime, compiles to template strings
✅ **Modern** - JSX is widely understood
✅ **Composable** - Easy to create reusable components
✅ **Effect-friendly** - Natural integration with Effect patterns

## Next Steps

1. Review this proposal
2. Approve approach
3. I'll create the migration implementation
