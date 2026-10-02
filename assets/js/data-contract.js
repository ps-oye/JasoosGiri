export const CURRENT_SCHEMA_VERSION = 1;

export function validateCaseJson(value) {
  const errors = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("Root JSON value must be an object.");
    return { valid: false, errors };
  }

  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CURRENT_SCHEMA_VERSION}.`);
  }

  if (!Array.isArray(value.sections)) {
    errors.push("sections must be an array.");
  } else {
    value.sections.forEach((section, index) => {
      const label = `sections[${index}]`;
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        errors.push(`${label} must be an object.`);
        return;
      }
      if (typeof section.key !== "string" || !section.key.trim()) errors.push(`${label}.key must be a non-empty string.`);
      if (typeof section.name !== "string" || !section.name.trim()) errors.push(`${label}.name must be a non-empty string.`);
      if (!Object.prototype.hasOwnProperty.call(section, "description")) errors.push(`${label}.description is required.`);
      const t = typeof section.description;
      const ok = t === "string" || Array.isArray(section.description) || (section.description && t === "object");
      if (!ok) errors.push(`${label}.description must be a string, array, or object.`);
    });
  }

  if (value.guessOptions !== undefined) {
    if (!Array.isArray(value.guessOptions)) {
      errors.push("guessOptions must be an array when provided.");
    } else {
      value.guessOptions.forEach((item, index) => {
        const label = `guessOptions[${index}]`;
        if (typeof item === "string") return;
        if (!item || typeof item !== "object" || typeof item.name !== "string") {
          errors.push(`${label} must be a string or an object with a name.`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseAndValidateCaseJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { valid: false, errors: [`Invalid JSON: ${error.message}`] };
  }
  const result = validateCaseJson(parsed);
  return { ...result, value: parsed };
}
