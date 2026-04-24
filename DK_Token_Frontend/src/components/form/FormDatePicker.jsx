import { Controller, useFormContext } from 'react-hook-form';

import Input from '../ui/Input';

function FormDatePicker({ name, ...props }) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <label className="block space-y-2">
          {props.label ? <span className="text-sm font-semibold text-zinc-200">{props.label}</span> : null}
          <Input
            {...field}
            className={fieldState.error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}
            type="date"
            value={field.value || ''}
          />
          {fieldState.error?.message ? <span className="text-xs text-rose-600">{fieldState.error.message}</span> : null}
        </label>
      )}
    />
  );
}

export default FormDatePicker;
