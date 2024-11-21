import TextBox from 'jsapp/js/components/common/textBox';
import organizationSettingsStyles from 'js/account/organization/organizationSettingsRoute.module.scss';

interface Props {
  label: string;
  value: string;
  onChange?: (newValue: string) => void;
  validateValue?: (currentValue: string) => string | boolean | string[] | undefined;
}

export default function OrganizationSettingsField({label, value, onChange, validateValue}: Props) {
  return (
    <div className={organizationSettingsStyles.field}>
      <TextBox
        label={label}
        value={value}
        required
        onChange={onChange}
        disabled={!onChange}
        errors={validateValue ? validateValue(value) : undefined}
      />
    </div>
  );
}
