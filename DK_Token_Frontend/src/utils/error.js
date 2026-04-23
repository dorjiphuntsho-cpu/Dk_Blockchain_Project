export function getErrorMessage(error, fallbackMessage = 'An unexpected error occurred.') {
  const validationMessages = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
        .map((item) => {
          const path = item?.path ? `${item.path}: ` : '';
          return item?.message ? `${path}${item.message}` : null;
        })
        .filter(Boolean)
    : [];

  if (validationMessages.length) {
    return validationMessages.join(' ');
  }

  const responseMessage = error?.response?.data?.message;

  if (responseMessage) {
    return responseMessage;
  }

  const nestedMessage =
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.data?.message ||
    error?.cause?.message ||
    error?.reason;

  if (nestedMessage) {
    return String(nestedMessage);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
