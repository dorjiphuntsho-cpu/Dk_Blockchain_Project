import FormTextField from './FormTextField';

function FormSelect({ name, options = [], helperText, ...props }) {
  return (
    <FormTextField helperText={helperText} name={name} select {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormTextField>
  );
}

export default FormSelect;
