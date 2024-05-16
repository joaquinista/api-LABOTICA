import readline from "readline";

export const writeStdOut = (message: string, last: boolean = false) => {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(message);
  if (last) process.stdout.write("\n");
};
