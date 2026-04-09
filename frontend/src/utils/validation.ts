export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function validateUniverse(data: { title: string; description: string; genre: string }): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Название вселенной обязательно' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Название не должно превышать 200 символов' });
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Описание вселенной обязательно' });
  } else if (data.description.length > 2000) {
    errors.push({ field: 'description', message: 'Описание не должно превышать 2000 символов' });
  }

  if (!data.genre || data.genre.trim().length === 0) {
    errors.push({ field: 'genre', message: 'Жанр вселенной обязателен' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateCharacter(data: { name: string }): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Имя персонажа обязательно' });
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Имя не должно превышать 100 символов' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateLocation(data: { name: string }): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Название локации обязательно' });
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Название не должно превышать 100 символов' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateChapter(data: { title: string; chapter_number?: number }): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Название главы обязательно' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Название не должно превышать 200 символов' });
  }

  if (data.chapter_number !== undefined && data.chapter_number < 1) {
    errors.push({ field: 'chapter_number', message: 'Номер главы должен быть положительным числом' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateNote(data: { title: string }): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Название заметки обязательно' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Название не должно превышать 200 символов' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
