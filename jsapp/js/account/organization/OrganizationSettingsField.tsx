import TextBox from 'jsapp/js/components/common/textBox';
import organizationSettingsStyles from 'js/account/organization/organizationSettingsRoute.module.scss';

interface Props {
  label: string;
  value: string;
  isDisabled?: boolean;
  /** If `onChange` is not provided, we make the field disabled for safety. */
  onChange?: (newValue: string) => void;
  /**
   * Function that ensures that field value is valid. If invalid will cause
   * an error to be displayed.
   */
  validateValue?: (currentValue: string) => string | boolean | string[] | undefined;
}

/**
 * A `TextBox` wrapper componet for `OrganizationSettingsRoute` that makes code
 * a bit more DRY.
 */
export default function OrganizationSettingsField(
  {label, value, isDisabled, onChange, validateValue}: Props
) {
  return (
    <div className={organizationSettingsStyles.field}>
      <TextBox
        label={label}
        value={value}
        required
        onChange={onChange}
        disabled={!onChange || isDisabled}
        errors={validateValue ? validateValue(value) : undefined}
      />
    </div>
  );
}
