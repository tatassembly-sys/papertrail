// Installed before integration and coverage tests. Unknown hosts still use real DNS
// so the in-memory MongoDB can resolve localhost. Scripted names come from tests.
import { mock } from "node:test";
import * as realDns from "node:dns/promises";

mock.module("dns/promises", {
  namedExports: {
    ...realDns,
    lookup: async (hostname, options) => {
      const key = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, "");
      const script = globalThis.__ptDnsScript?.get(key);
      if (script === "fail") throw new Error("dns failure");
      if (script === "empty") return [];
      if (script) {
        if (options?.all === false) return script[0];
        return script;
      }
      return realDns.lookup(hostname, options);
    },
  },
});
