/** Process exit codes (Section 12.4 of the implementation plan). */
export const EXIT_CODES = {
  success: 0,
  flowFailed: 1,
  usageError: 2,
  loginRequired: 3,
  invalidConfig: 4,
  profileLocked: 5,
  environmentProblem: 6,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
