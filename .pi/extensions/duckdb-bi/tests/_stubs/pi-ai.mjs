// Test-only stub for @earendil-works/pi-ai. Tools use StringEnum only
// at registration time to build schemas; identity metadata is sufficient.
export function StringEnum(values) {
  return { __type: "StringEnum", values };
}
