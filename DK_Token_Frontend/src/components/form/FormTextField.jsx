import { Children, isValidElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { cn } from '../../utils/cn';

function normalizeSelectChildren(children) {
  return Children.toArray(children)
    .filter(Boolean)
    .map((child, index) => {
      if (!isValidElement(child)) {
        return child;
      }

      const { value, disabled, children: optionLabel } = child.props || {};

      return (
        <option disabled={disabled} key={child.key ?? `${value ?? 'option'}-${index}`} value={value ?? ''}>
          {typeof optionLabel === 'string' || typeof optionLabel === 'number'
            ? optionLabel
            : Children.toArray(optionLabel).join('')}
        </option>
      );
    });
}

function FormTextField({
  name,
  helperText,
  label,
  select = false,
  multiline = false,
  minRows,
  children,
  className,
  InputProps,
  inputProps,
  ...props
}) {
  const { control } = useFormContext();
  const normalizedChildren = select ? normalizeSelectChildren(children) : children;
  const isReadOnly = Boolean(InputProps?.readOnly || inputProps?.readOnly || props.readOnly);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <label className="block space-y-2">
          {label ? <span className="text-sm font-medium text-zinc-200">{label}</span> : null}
          {select ? (
            <Select
              {...field}
              className={cn(fieldState.error ? 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-500/20' : '', className)}
              value={field.value ?? ''}
              {...props}
            >
              {normalizedChildren}
            </Select>
          ) : multiline ? (
            <Textarea
              {...field}
              className={cn(fieldState.error ? 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-500/20' : '', className)}
              rows={minRows || 4}
              value={field.value ?? ''}
              readOnly={isReadOnly}
              {...props}
            />
          ) : (
            <Input
              {...field}
              className={cn(fieldState.error ? 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-500/20' : '', className)}
              readOnly={isReadOnly}
              value={field.value ?? ''}
              {...props}
            />
          )}
          {(fieldState.error?.message || helperText) ? (
            <span className={cn('block text-xs', fieldState.error ? 'text-rose-400' : 'text-zinc-500')}>
              {fieldState.error?.message || helperText}
            </span>
          ) : null}
        </label>
      )}
    />
  );
}

export default FormTextField;
