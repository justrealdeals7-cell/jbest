import { STATES, LGAS_BY_STATE } from "../lib/nigeria";

// Renders a State select + a dependent LGA select. `stateKey`/`lgaKey` are
// the form field names this pair writes to (e.g. "origin_state"/"origin_lga").
export default function LocationSelects({ label, form, setField, stateKey, lgaKey, inputStyle }) {
  const lgas = form[stateKey] ? LGAS_BY_STATE[form[stateKey]] || [] : [];

  return (
    <>
      <select
        style={inputStyle}
        value={form[stateKey] || ""}
        onChange={(e) => {
          setField(stateKey, e.target.value);
          setField(lgaKey, ""); // reset LGA when state changes
        }}
      >
        <option value="">{label} state</option>
        {STATES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        style={inputStyle}
        value={form[lgaKey] || ""}
        onChange={(e) => setField(lgaKey, e.target.value)}
        disabled={!form[stateKey]}
      >
        <option value="">{label} LGA</option>
        {lgas.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </>
  );
}
