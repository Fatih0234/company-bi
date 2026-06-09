// Test-only stub for the typebox library. The tool uses Type.Object, Type.String,
// Type.Optional, Type.Boolean, Type.Number, Type.Array only at registration time
// to build a JSON schema. We don't need real validation in the test — the
// tool's execute() receives params as a plain object. Identity stubs are
// sufficient and produce no runtime side-effects.

const stub = (kind) => (opts) => ({ __type: kind, opts });
const wrap = (inner) => ({ __type: "Optional", inner });

export const Type = {
  Object: (props) => ({ __type: "Object", props }),
  String: stub("String"),
  Number: stub("Number"),
  Boolean: stub("Boolean"),
  Array: (inner) => ({ __type: "Array", inner }),
  Optional: wrap,
};
