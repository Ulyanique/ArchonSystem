// src/utils/storage.ts
// Универсальный слой для localStorage с типизацией и миграциями

export type StorageValue = string | number | boolean | object | null;

export interface StorageItem<T> {
  key: string;
  defaultValue: T;
  migrate?: (value: unknown) => T;
}

export class LocalStorageManager {
  private static instance: LocalStorageManager;

  private constructor() {}

  static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }

  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.warn(`[storage] Не удалось сохранить ${key}:`, e);
    }
  }

  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (e) {
      console.warn(`[storage] Не удалось прочитать ${key}, возвращаю default`, e);
      return defaultValue;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[storage] Не удалось удалить ${key}:`, e);
    }
  }

  // Пакетное получение
  getMany<T extends Record<string, unknown>>(items: StorageItem<unknown>[]): T {
    return items.reduce((acc, item) => {
      acc[item.key as keyof T] = this.get(item.key, item.defaultValue) as T[keyof T];
      return acc;
    }, {} as T);
  }

  // Пакетная запись
  setMany(items: { key: string; value: unknown }[]): void {
    items.forEach(({ key, value }) => this.set(key, value));
  }
}

export const storage = LocalStorageManager.getInstance();