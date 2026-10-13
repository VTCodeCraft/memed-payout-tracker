import { ApiError, apiRequest } from "./api-client.ts";
import { type FieldProblems, type FormFeedback, validationFeedback } from "./form-feedback.ts";
import { type Role, type Session, type User, SessionStorageError, saveSession } from "./session.ts";

/** Body of a successful POST /auth/signup (201) or POST /auth/login (200). */
interface AuthResponse {
  token: string;
  user: User;
}

const HOME_BY_ROLE: Record<Role, string> = { brand: "/brand", creator: "/creator" };

/** Where a signed-in user of this role lands. */
export function homePath(role: Role): string {
  return HOME_BY_ROLE[role];
}

export interface SignupForm {
  name: string;
  email: string;
  password: string;
  role: Role | "";
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export const SIGNUP_FIELDS = ["name", "email", "password", "role"] as const;

// The same rules as the API's signup schema, checked first so obvious mistakes need no
// round trip. The API stays the authority: its answer is shown whatever this says.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

function emailProblem(email: string): string | undefined {
  if (email.trim() === "") return "is required";
  if (!EMAIL_SHAPE.test(email.trim())) return "must be a valid email address";
  return undefined;
}

export function checkSignup(form: SignupForm): { input: SignupInput } | { problems: FieldProblems } {
  const problems: FieldProblems = {};
  const name = form.name.trim();
  if (name === "") problems.name = "is required";
  else if (name.length < 2) problems.name = "must be at least 2 characters";
  else if (name.length > 60) problems.name = "must be at most 60 characters";

  const email = emailProblem(form.email);
  if (email) problems.email = email;

  if (form.password === "") problems.password = "is required";
  else if (form.password.length < 8) problems.password = "must be at least 8 characters";
  else if (new TextEncoder().encode(form.password).length > BCRYPT_MAX_PASSWORD_BYTES) {
    problems.password = `must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`;
  }

  if (form.role === "") problems.role = "choose brand or creator";

  if (Object.keys(problems).length > 0 || form.role === "") return { problems };
  return { input: { name: form.name, email: form.email, password: form.password, role: form.role } };
}

export interface LoginForm {
  email: string;
  password: string;
}

export const LOGIN_FIELDS = ["email", "password"] as const;

// Presence only, like the API's login schema: password rules belong to signup, and
// checking them here would tell a guesser what the rules are.
export function checkLogin(form: LoginForm): { input: LoginForm } | { problems: FieldProblems } {
  const problems: FieldProblems = {};
  const email = emailProblem(form.email);
  if (email) problems.email = email;
  if (form.password === "") problems.password = "is required";
  return Object.keys(problems).length > 0 ? { problems } : { input: form };
}

/** Signs in and stores the returned session. Rejects with ApiError or SessionStorageError. */
export async function logIn(input: LoginForm): Promise<Session> {
  const { token, user } = await apiRequest<AuthResponse>("auth/login", { method: "POST", body: input });
  return saveSession(token, user);
}

/** Creates the account and stores the returned session. Rejects with ApiError or SessionStorageError. */
export async function signUp(input: SignupInput): Promise<Session> {
  const { token, user } = await apiRequest<AuthResponse>("auth/signup", { method: "POST", body: input });
  return saveSession(token, user);
}

/** Turns a failed signup or login into what the form shows. */
export function authFailure(error: unknown, formFields: readonly string[]): FormFeedback {
  if (error instanceof SessionStorageError) return { fields: {}, message: error.message };
  if (!(error instanceof ApiError)) {
    console.error(error);
    return { fields: {}, message: "Something went wrong. Please try again." };
  }

  switch (error.code) {
    case "VALIDATION_ERROR":
      return validationFeedback(error, (path) => formFields.includes(path));
    case "INVALID_CREDENTIALS":
      // The API uses one answer for an unknown email and a wrong password; so does this.
      return { fields: {}, message: "That email and password don't match an account. Check both and try again." };
    case "EMAIL_TAKEN":
      return { fields: { email: "an account with this email already exists" } };
    case "RATE_LIMITED":
      return { fields: {}, message: "Too many attempts from your network. Wait a few minutes, then try again." };
    default:
      // NETWORK_ERROR, SERVER_UNAVAILABLE and the API's own errors already carry readable messages.
      return { fields: {}, message: error.message };
  }
}
