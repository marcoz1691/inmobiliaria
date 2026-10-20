/** Result of a public form Server Action, consumed with `useActionState`. */
export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string> };

export const IDLE: FormState = { status: "idle" };
