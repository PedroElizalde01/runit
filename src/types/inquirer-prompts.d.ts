declare module "@inquirer/prompts" {
  export function confirm(options: {
    message: string;
    default?: boolean;
  }): Promise<boolean>;

  export function input(options: {
    message: string;
    default?: string;
  }): Promise<string>;

  export function select<T>(options: {
    message: string;
    choices: Array<{
      name: string;
      value: T;
    }>;
  }): Promise<T>;
}
