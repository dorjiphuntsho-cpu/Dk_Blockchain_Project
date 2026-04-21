import FormTextField from './FormTextField';

function FormAmountField(props) {
  return <FormTextField inputMode="decimal" placeholder="0.00" {...props} />;
}

export default FormAmountField;
