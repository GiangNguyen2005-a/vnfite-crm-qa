const TOKENS = require("./qa_perm_tokens.json");
const BASE = "http://localhost:2345";
const CID = "082a18e5-f6a2-475c-b499-6f01fab64bc5";

async function call(role, method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: "Bearer " + TOKENS[role].token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let txt = "";
  try { txt = (await r.text()).slice(0, 90).replace(/\s+/g, " "); } catch (e) { txt = ""; }
  return [r.status, txt];
}

(async () => {
  const probes = [
    ["sale", "GET", "/rbac/roles"],
    ["sale", "GET", "/rbac/permissions"],
    ["sale", "GET", "/permissions/me"],
    ["admin", "GET", "/customer/all?page=1&limit=2&app_code=vnfite"],
    ["sale", "GET", "/customer/all?page=1&limit=2&app_code=vnfite"],
    ["exec", "GET", "/customer/all?page=1&limit=2&app_code=vnfite"],
    ["admin", "GET", "/commission/all?page=1&limit=2"],
    ["sale", "GET", "/commission/all?page=1&limit=2"],
    ["admin", "GET", "/investment/all?page=1&limit=2"],
    ["sale", "GET", "/kpi/team"],
    ["sale", "GET", "/hotline/config"],
    ["sale", "POST", "/hotline/config", {}],
    ["sale", "POST", `/customer/${CID}/assign`, { assigned_to: "x" }],
    ["sale", "POST", `/customer/${CID}/return-to-pool`, {}],
    ["sale", "POST", `/customer/${CID}/exclude`, {}],
    ["exec", "POST", `/customer/${CID}/assign`, { assigned_to: "x" }],
    ["admin", "PATCH", "/rbac/roles/abc", { permissions: [] }],
    ["sale", "GET", `/customer/detail?external_id=${CID}`],
    ["sale", "GET", `/customer/${CID}`]
  ];
  for (const [role, m, p, b] of probes) {
    try {
      const [s, t] = await call(role, m, p, b);
      console.log(String(s).padEnd(4), role.padEnd(8), m.padEnd(6), p.slice(0, 55).padEnd(56), t.slice(0, 60));
    } catch (e) {
      console.log("ERR ", role, m, p, String(e).slice(0, 60));
    }
  }
})();
