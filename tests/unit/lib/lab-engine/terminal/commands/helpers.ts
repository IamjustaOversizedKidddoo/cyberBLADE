import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";

export const shell = () => createShell(fixtureWorld());
export const run = (line: string) => shell().exec(line);
