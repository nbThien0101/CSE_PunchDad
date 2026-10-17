import { forwardRef, useCallback, useContext, useRef } from 'react';
import { FocusScope } from '@react-aria/focus';
import { useDialog } from '@react-aria/dialog';
import { createButton } from '@gluestack-ui/core/button/creator';
import { createInput } from '@gluestack-ui/core/input/creator';
import { createTextarea } from '@gluestack-ui/core/textarea/creator';
import { createAlert } from '@gluestack-ui/core/alert/creator';
import { createModal, ModalContext } from '@gluestack-ui/core/modal/creator';

// Gluestack Core supplies interaction/context; DOM adapters preserve browser form
// semantics (submit, date/time, file inputs, refs) in the existing Vite application.
function domProps({ states, dataSet, onPress, onPressIn, onPressOut, onHoverIn, onHoverOut,
  accessible, accessibilityElementsHidden, accessibilityViewIsModal, onAccessibilityEscape,
  secureTextEntry, editable, multiline, context, exit, ...props }) {
  const result = { ...props };
  for (const [key, value] of Object.entries(dataSet || {})) {
    result[`data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`] = String(value);
  }
  if (onPress && !result.onClick) result.onClick = onPress;
  if (onPressIn) result.onPointerDown = onPressIn;
  if (onPressOut) result.onPointerUp = onPressOut;
  if (onHoverIn) result.onPointerEnter = onHoverIn;
  if (onHoverOut) result.onPointerLeave = onHoverOut;
  if (editable === false) result.readOnly = true;
  // Core's fallback label would override the real <label htmlFor> association.
  if (result['aria-label'] === 'Input Field') delete result['aria-label'];
  return result;
}

function element(tag) {
  const Component = forwardRef((props, ref) => {
    const Tag = tag;
    return <Tag {...domProps(props)} ref={ref} />;
  });
  Component.displayName = `GluestackDOM(${tag})`;
  return Component;
}

const Div = element('div');
const Span = element('span');
const InputElement = element('input');
const TextareaElement = element('textarea');
const ButtonElement = element('button');
const coreButton = createButton({ Root: ButtonElement, Text: Span, Group: Div, Spinner: Span, Icon: Span });
const CoreButton = coreButton;
const CoreInput = createInput({ Root: Span, Input: InputElement, Icon: Span, Slot: Span });
const CoreTextarea = createTextarea({ Root: Span, Input: TextareaElement });
const CoreAlert = createAlert({ Root: Div, Text: Span, Icon: Span });

export const Button = forwardRef(({ disabled, isDisabled, className = '', variant, size, ...props }, ref) => (
  <CoreButton {...props} ref={ref} isDisabled={isDisabled ?? disabled}
    className={`ui-button ${variant ? `ui-button-${variant}` : ''} ${size ? `ui-button-${size}` : ''} ${className}`} />
));
Button.displayName = 'Button';

export const Input = forwardRef(({ disabled, readOnly, required, className = '', type = 'text', ...props }, ref) => {
  const attributes = { ...props, type, disabled, readOnly, required, className: `ui-input ${className}`, ref };
  if (['checkbox', 'radio', 'file', 'hidden', 'range', 'color'].includes(type)) return <InputElement {...attributes} />;
  return (
    <CoreInput className="ui-field-root" isDisabled={disabled} isReadOnly={readOnly} isRequired={required}>
      <CoreInput.Input {...attributes} />
    </CoreInput>
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef(({ disabled, readOnly, required, className = '', ...props }, ref) => (
  <CoreTextarea className="ui-field-root" isDisabled={disabled} isReadOnly={readOnly} isRequired={required}>
    <CoreTextarea.Input {...props} ref={ref} required={required} readOnly={readOnly} className={`ui-textarea ${className}`} />
  </CoreTextarea>
));
Textarea.displayName = 'Textarea';

// Native selects retain browser keyboard navigation and mobile system pickers.
export const Select = forwardRef(({ className = '', ...props }, ref) => <select {...props} ref={ref} className={`ui-select ${className}`} />);
Select.displayName = 'Select';
export const Box = forwardRef(({ as: Tag = 'div', ...props }, ref) => <Tag {...props} ref={ref} />);
Box.displayName = 'Box';
export const Card = forwardRef(({ className = '', ...props }, ref) => <Box {...props} ref={ref} className={`ui-card ${className}`} />);
Card.displayName = 'Card';
export const Badge = forwardRef(({ className = '', ...props }, ref) => <Box {...props} as="span" ref={ref} className={`ui-badge ${className}`} />);
Badge.displayName = 'Badge';
export const Alert = forwardRef(({ className = '', ...props }, ref) => <CoreAlert {...props} ref={ref} className={`ui-alert ${className}`} />);
Alert.displayName = 'Alert';

export const GluestackModal = createModal({ Root: Div, Content: Div, Backdrop: Div,
  Header: Div, Body: Div, Footer: Div, CloseButton: ButtonElement });

// Core v3's native Content calls findNodeHandle, removed in React Native Web.
// Use the same React Aria dialog/focus behavior directly on a real DOM ref.
const DialogContent = forwardRef((props, forwardedRef) => {
  const { visible } = useContext(ModalContext);
  const localRef = useRef(null);
  const ref = useCallback(node => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  const { dialogProps } = useDialog(props, localRef);
  return <FocusScope contain={visible} autoFocus={visible} restoreFocus>
    <Div {...props} {...dialogProps} ref={ref} aria-modal="true" role="dialog" tabIndex={-1} />
  </FocusScope>;
});
DialogContent.displayName = 'GluestackWebDialogContent';
GluestackModal.Content = DialogContent;
