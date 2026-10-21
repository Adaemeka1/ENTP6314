// The "I'm a driver / I'm a mechanic" choice, used on sign-up and choose-role.
export function RolePicker() {
  return (
    <fieldset className="roles">
      <legend>I’m signing up as a…</legend>
      <label className="role">
        <input type="radio" name="role" value="driver" required />
        <span>
          <strong>Driver</strong>
          <small>I need help with my car</small>
        </span>
      </label>
      <label className="role">
        <input type="radio" name="role" value="mechanic" required />
        <span>
          <strong>Mechanic</strong>
          <small>I want to fix cars for NemaGo</small>
        </span>
      </label>
    </fieldset>
  );
}
