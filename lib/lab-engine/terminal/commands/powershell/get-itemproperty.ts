import { formatGetItem, formatItemProperty, getRegistryKey } from "../../windows/registry";
import type { Command } from "../types";
import { fail, ok } from "../util";

export const getItemProperty: Command = {
  name: "Get-ItemProperty",
  summary: "get properties of a specified item such as a registry key",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let path = "";
    let propName = "";

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-Path" && i + 1 < args.length) {
        path = args[++i];
      } else if (a === "-Name" && i + 1 < args.length) {
        propName = args[++i];
      } else if (!a.startsWith("-") && !path) {
        path = a;
      }
    }

    if (!path) {
      return fail("Get-ItemProperty : Cannot validate argument on parameter 'Path'. The argument is null or empty.\n");
    }

    const found = getRegistryKey(ctx.registry, path);
    if (!found) {
      return fail(`Get-ItemProperty : Cannot find path '${path}' because it does not exist.\n`);
    }

    if (propName) {
      const match = Object.entries(found.values).find(([k]) => k.toLowerCase() === propName.toLowerCase());
      if (!match) {
        return fail(`Get-ItemProperty : Property ${propName} does not exist at path ${path}.\n`);
      }
      return ok(`${match[1]}\n`);
    }

    return ok(formatItemProperty(found.normalizedPath, found.values));
  },
};

export const getItem: Command = {
  name: "Get-Item",
  summary: "get the item at the specified location",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let path = "";

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-Path" && i + 1 < args.length) {
        path = args[++i];
      } else if (!a.startsWith("-") && !path) {
        path = a;
      }
    }

    if (!path) {
      return fail("Get-Item : Cannot validate argument on parameter 'Path'. The argument is null or empty.\n");
    }

    const found = getRegistryKey(ctx.registry, path);
    if (!found) {
      return fail(`Get-Item : Cannot find path '${path}' because it does not exist.\n`);
    }

    return ok(formatGetItem(found.normalizedPath, found.values));
  },
};

export const gp: Command = {
  ...getItemProperty,
  name: "gp",
};

export const gi: Command = {
  ...getItem,
  name: "gi",
};
