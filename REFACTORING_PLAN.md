# План рефакторинга авторизации TikTok API на принципах ООП

## Обзор текущей архитектуры

Текущая реализация авторизации в TikTok API представляет собой набор разрозненных функций и сервисов:

- Отдельные функции для каждого шага авторизации (`clickLoginButton`, `fillLoginForm`, `submitLoginForm`, и т.д.)
- Сервисные классы для специфических задач (`CaptchaDetectionService`, `SadCaptchaService`, `EmailApiService`)
- Отсутствие единого интерфейса для управления процессом авторизации
- Отсутствие централизованного управления сессиями

## Проблемы текущей архитектуры

1. **Отсутствие четкой инкапсуляции** - логика авторизации разбросана по отдельным функциям
2. **Слабая связность** - шаги авторизации не объединены в единый процесс
3. **Сложность управления состоянием** - нет единого места для хранения состояния авторизации
4. **Дублирование кода** - повторяющиеся паттерны для поиска элементов и обработки ошибок
5. **Отсутствие абстракций** - нет интерфейсов для разных типов авторизации или провайдеров капчи
6. **Сложность тестирования** - функциональный подход затрудняет модульное тестирование

## Предлагаемая ООП структура

### 1. Основные интерфейсы

```typescript
// Интерфейс для авторизации
interface IAuthenticator {
  login(credentials: AuthCredentials): Promise<AuthResult>;
  verifySession(): Promise<boolean>;
  refreshSession(): Promise<boolean>;
  logout(): Promise<void>;
}

// Интерфейс для обработки капчи
interface ICaptchaSolver {
  detect(page: Page): Promise<CaptchaDetectionResult>;
  solve(page: Page, detectionResult: CaptchaDetectionResult): Promise<boolean>;
}

// Интерфейс для обработки email-верификации
interface IEmailVerificationHandler {
  waitForCode(email: string): Promise<string | null>;
  submitCode(page: Page, code: string): Promise<boolean>;
}

// Интерфейс для управления сессиями
interface ISessionManager {
  createSession(credentials: AuthCredentials): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<Session[]>;
}
```

### 2. Модели данных

```typescript
// Модель учетных данных
interface AuthCredentials {
  email: string;
  password: string;
  proxyConfig?: ProxyConfig;
}

// Модель сессии
interface Session {
  id: string;
  userId: string;
  cookies: Cookie[];
  headers: Record<string, string>;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  proxyConfig?: ProxyConfig;
}

// Модель результата авторизации
interface AuthResult {
  success: boolean;
  session?: Session;
  error?: string;
}

// Модель результата обнаружения капчи
interface CaptchaDetectionResult {
  detected: boolean;
  selector?: string;
  screenshotPath?: string;
}

// Модель конфигурации прокси
interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
}
```

### 3. Основные классы

#### 3.1. Авторизация в TikTok

```typescript
class TikTokAuthenticator implements IAuthenticator {
  private page: Page;
  private logger: Log;
  private captchaSolver: ICaptchaSolver;
  private emailVerifier: IEmailVerificationHandler;
  private sessionManager: ISessionManager;
  
  constructor(
    page: Page, 
    logger: Log, 
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager
  ) {
    this.page = page;
    this.logger = logger;
    this.captchaSolver = captchaSolver;
    this.emailVerifier = emailVerifier;
    this.sessionManager = sessionManager;
  }
  
  async login(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      // Реализация процесса авторизации с использованием стратегии
      await this.navigateToLoginPage();
      await this.selectLoginMethod();
      await this.fillLoginForm(credentials);
      await this.submitLoginForm();
      
      // Обработка капчи при необходимости
      const captchaResult = await this.captchaSolver.detect(this.page);
      if (captchaResult.detected) {
        const solved = await this.captchaSolver.solve(this.page, captchaResult);
        if (!solved) {
          return { success: false, error: "Failed to solve captcha" };
        }
      }
      
      // Обработка email-верификации при необходимости
      const needsEmailVerification = await this.checkEmailVerification();
      if (needsEmailVerification) {
        const code = await this.emailVerifier.waitForCode(credentials.email);
        if (!code) {
          return { success: false, error: "Failed to get verification code" };
        }
        
        const verified = await this.emailVerifier.submitCode(this.page, code);
        if (!verified) {
          return { success: false, error: "Failed to verify email code" };
        }
      }
      
      // Сохранение сессии
      const session = await this.extractSessionData();
      await this.sessionManager.saveSession(session);
      
      return { success: true, session };
    } catch (error) {
      this.logger.error('Login failed', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  async verifySession(): Promise<boolean> {
    // Проверка валидности текущей сессии
  }
  
  async refreshSession(): Promise<boolean> {
    // Обновление текущей сессии
  }
  
  async logout(): Promise<void> {
    // Выход из системы
  }
  
  // Вспомогательные методы
  private async navigateToLoginPage(): Promise<void> {
    // Навигация на страницу логина
  }
  
  private async selectLoginMethod(): Promise<void> {
    // Выбор метода логина (email/телефон)
  }
  
  private async fillLoginForm(credentials: AuthCredentials): Promise<void> {
    // Заполнение формы логина
  }
  
  private async submitLoginForm(): Promise<void> {
    // Отправка формы логина
  }
  
  private async checkEmailVerification(): Promise<boolean> {
    // Проверка необходимости email-верификации
  }
  
  private async extractSessionData(): Promise<Session> {
    // Извлечение данных сессии из страницы
  }
}
```

#### 3.2. Обработка капчи

```typescript
class SadCaptchaSolver implements ICaptchaSolver {
  private logger: Log;
  private apiKey: string;
  
  constructor(logger: Log, apiKey: string) {
    this.logger = logger;
    this.apiKey = apiKey;
  }
  
  async detect(page: Page): Promise<CaptchaDetectionResult> {
    // Реализация обнаружения капчи
  }
  
  async solve(page: Page, detectionResult: CaptchaDetectionResult): Promise<boolean> {
    // Реализация решения капчи через SadCaptcha API
  }
}
```

#### 3.3. Обработка email-верификации

```typescript
class TikTokEmailVerificationHandler implements IEmailVerificationHandler {
  private logger: Log;
  private emailApiService: EmailApiService;
  
  constructor(logger: Log, emailApiService: EmailApiService) {
    this.logger = logger;
    this.emailApiService = emailApiService;
  }
  
  async waitForCode(email: string): Promise<string | null> {
    // Реализация ожидания кода верификации
  }
  
  async submitCode(page: Page, code: string): Promise<boolean> {
    // Реализация ввода кода верификации
  }
}
```

#### 3.4. Управление сессиями

```typescript
class FileSystemSessionManager implements ISessionManager {
  private logger: Log;
  private storagePath: string;
  
  constructor(logger: Log, storagePath: string) {
    this.logger = logger;
    this.storagePath = storagePath;
  }
  
  async createSession(credentials: AuthCredentials): Promise<Session> {
    // Создание новой сессии
  }
  
  async getSession(sessionId: string): Promise<Session | null> {
    // Получение сессии по ID
  }
  
  async saveSession(session: Session): Promise<void> {
    // Сохранение сессии
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    // Удаление сессии
  }
  
  async listSessions(): Promise<Session[]> {
    // Список всех сессий
  }
}
```

### 4. Фабрики и провайдеры

```typescript
// Фабрика для создания авторизаторов
class AuthenticatorFactory {
  static createTikTokAuthenticator(
    page: Page, 
    logger: Log, 
    config: AuthConfig
  ): IAuthenticator {
    const captchaSolver = new SadCaptchaSolver(logger, config.sadCaptchaApiKey);
    const emailApiService = new EmailApiService(logger);
    const emailVerifier = new TikTokEmailVerificationHandler(logger, emailApiService);
    const sessionManager = new FileSystemSessionManager(logger, config.sessionStoragePath);
    
    return new TikTokAuthenticator(page, logger, captchaSolver, emailVerifier, sessionManager);
  }
}
```

## Преимущества предлагаемого подхода

1. **Улучшенная инкапсуляция** - каждый класс отвечает за конкретную задачу
2. **Принцип единственной ответственности** - каждый класс имеет четкую зону ответственности
3. **Принцип открытости/закрытости** - легко расширять функциональность без изменения существующего кода
4. **Принцип подстановки Лисков** - интерфейсы позволяют заменять реализации без изменения клиентского кода
5. **Принцип инверсии зависимостей** - высокоуровневые модули не зависят от низкоуровневых деталей
6. **Улучшенная тестируемость** - возможность мокать зависимости для модульного тестирования
7. **Гибкость** - легко добавлять новые методы авторизации или провайдеры капчи
8. **Повторное использование кода** - общие компоненты могут использоваться в разных частях системы

## План внедрения

### Этап 1: Создание интерфейсов и моделей данных (1-2 дня)
- Определение всех необходимых интерфейсов
- Создание моделей данных для авторизации
- Документирование контрактов интерфейсов

### Этап 2: Реализация компонентов обработки капчи (2-3 дня)
- Создание класса для обнаружения капчи
- Реализация интеграции с SadCaptcha API
- Тестирование обработки различных типов капчи

### Этап 3: Реализация компонентов email-верификации (2-3 дня)
- Создание класса для обработки email-верификации
- Интеграция с существующим EmailApiService
- Тестирование получения и ввода кодов верификации

### Этап 4: Реализация управления сессиями (3-4 дня)
- Создание класса для управления сессиями
- Реализация сохранения и загрузки сессий
- Реализация механизмов обновления и проверки сессий
- Тестирование работы с сессиями

### Этап 5: Реализация основного класса авторизации (4-5 дней)
- Создание класса TikTokAuthenticator
- Реализация всех шагов процесса авторизации
- Интеграция с компонентами капчи, email-верификации и управления сессиями
- Тестирование полного процесса авторизации

### Этап 6: Создание фабрик и провайдеров (1-2 дня)
- Реализация фабрик для создания компонентов
- Настройка внедрения зависимостей
- Тестирование создания компонентов через фабрики

### Этап 7: Интеграция с существующим кодом (3-4 дня)
- Постепенная замена существующих функций на новые классы
- Адаптация существующего кода для работы с новой архитектурой
- Тестирование интеграции

### Этап 8: Написание тестов (3-4 дня)
- Создание модульных тестов для всех компонентов
- Создание интеграционных тестов для проверки взаимодействия компонентов
- Создание end-to-end тестов для проверки полного процесса авторизации

### Этап 9: Рефакторинг и оптимизация (2-3 дня)
- Анализ производительности
- Оптимизация узких мест
- Улучшение обработки ошибок
- Документирование кода

## Структура директорий

```
src/
├── auth/
│   ├── interfaces/
│   │   ├── IAuthenticator.ts
│   │   ├── ICaptchaSolver.ts
│   │   ├── IEmailVerificationHandler.ts
│   │   └── ISessionManager.ts
│   ├── models/
│   │   ├── AuthCredentials.ts
│   │   ├── AuthResult.ts
│   │   ├── CaptchaDetectionResult.ts
│   │   ├── ProxyConfig.ts
│   │   └── Session.ts
│   ├── implementations/
│   │   ├── TikTokAuthenticator.ts
│   │   ├── SadCaptchaSolver.ts
│   │   ├── TikTokEmailVerificationHandler.ts
│   │   └── FileSystemSessionManager.ts
│   ├── factories/
│   │   └── AuthenticatorFactory.ts
│   └── index.ts
```

## Заключение

Предлагаемый план рефакторинга позволит создать более структурированную, поддерживаемую и расширяемую архитектуру для функционала авторизации в TikTok API. Использование принципов ООП улучшит качество кода, упростит тестирование и обеспечит более надежную работу системы.

Реализация этого плана займет примерно 3-4 недели, в зависимости от сложности интеграции с существующим кодом и возникающих проблем. После завершения рефакторинга авторизации можно будет применить аналогичный подход к другим компонентам системы.
