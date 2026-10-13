# Frontend architecture

Decisions the upcoming screens build on. The code is the reference for how each piece works; this note records why, and what is planned.

## Rendering and data flow

The Express API on Render returns the JWT in a JSON body and expects `Authorization: Bearer <token>`. It sets no cookies, so the Next.js server never knows who is signed in. Therefore:

- Signed-in pages are client components. They call the API directly from the browser through `lib/api-client.ts`, which the API's CORS configuration allows.
- Public pages without user data (the landing page) stay server components.
- There are no Next.js route handlers or proxies in front of the API. A backend-for-frontend would duplicate the API and add a second cold-starting hop.

## Session

- `{ token, user }` from signup or login is stored in `localStorage`, so a session survives reloads and new tabs. The token is sent only as a Bearer header.
- Trade-off: script injected into the page could read the token. React escapes rendered text, the app renders no raw HTML and loads no third-party scripts, and tokens expire (7 days by default). An httpOnly cookie would remove the risk but needs cookie auth and CSRF protection on the API, a contract change outside this assignment.
- The session can only be read in the browser, so signed-in layouts render a neutral loading state until it has been read, rather than server-rendering a guess.
- Role checks in the UI only choose what to show. The API enforces every rule.

## Routes

| Route | Who | API calls | Milestone |
|---|---|---|---|
| `/` | anyone | none | exists |
| `/login`, `/signup` | signed out | `POST auth/login`, `POST auth/signup` | M11 |
| `/brand` | brand | `GET campaigns/mine`, totals summed from the list | M12 |
| `/brand/campaigns/new` | brand | `POST campaigns` | M12 |
| `/brand/campaigns/[id]` | brand | `GET campaigns/:id`, `GET campaigns/:id/submissions`, `PATCH submissions/:id/views` | M12 |
| `/creator` | creator | `GET submissions/earnings`, `GET submissions/mine` | M13 |
| `/creator/campaigns` | creator | `GET campaigns/live`, `POST submissions` | M13 |

- `/brand` and `/creator` each have a layout (`SignedInLayout`) that checks the stored token with `GET auth/me` once per page load, shows nothing protected until it passes, sends other roles to their own home using the API's role, and renders the app shell. The `(auth)` route group holds login and signup and shows them only to signed-out visitors; route groups do not change URLs.
- What a signed-in area shows (loading, a redirect, an error, or the page) is decided by the pure function `decideAccess()` in `lib/route-guard.ts`, which is unit tested. Signed-in visitors on login or signup are sent to their home by `SignedOutOnly`.
- There is no single-submission endpoint, so submission details come from the list responses. `PATCH submissions/:id/views` returns the updated submission, allocation and campaign remaining.

## UI states

Every view that loads data handles each state explicitly:

| State | Handling |
|---|---|
| Loading | Placeholder text in the content area. Buttons that submit are disabled and say what is happening ("Signing in…"). |
| Empty | Says what is missing and links to the action that fills it (for example "Create a campaign"). |
| Validation error (400 `VALIDATION_ERROR`) | `details[].path` maps onto form fields (`email`, `milestones.0.views`); any message with no matching field shows above the form. |
| API error | The API's own `message` in an `Alert`, plus a retry where retrying can help. |
| Unauthorized (401) | Clear the session and go to `/login?session=expired`, which says why. |
| Wrong role (403) | The role layout redirects to the user's own home before any page calls the API. |
| Network failure or cold start | `NETWORK_ERROR` / `SERVER_UNAVAILABLE` from the client. Render's free tier can take about a minute to wake, so the message says to retry. |
| Rate limited (429) | Show the API message. Forms stay filled in. |

## Visual rules

Tokens live in `src/app/globals.css`, each with its source.

- Light theme from Meme'd: white page, `ink` (#131313) text and 1px borders, no shadows or gradients.
- `brand` purple marks the one primary action on a screen, links and focus rings.
- `lime` and `green` are highlight fills with ink text, never text colours. `green` means live or paid.
- `danger` is for errors only.
- Pills for buttons and badges; 16px-radius cards with an ink border.
- Lowercase only for decorative eyebrow text, never for data, labels or buttons.
- Numbers that line up in columns use `tabular-nums` (Bricolage Grotesque supports it).
