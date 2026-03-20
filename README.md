# TowPrimePRO Dispatcher

Диспетчерская панель на `Vite + React + Firebase`.

## Локальный запуск

1. Создайте `.env.local` по примеру из `.env.example`.
2. Установите зависимости:

```bash
npm install
```

3. Запустите проект:

```bash
npm run dev
```

## Продакшн: GitHub + Firebase Hosting

Проект подготовлен к деплою на Firebase Hosting:

- [firebase.json](./firebase.json) содержит SPA rewrite на `index.html`
- [.firebaserc](./.firebaserc) привязан к проекту `towtruckdriverauth-300b9`
- [.github/workflows/firebase-hosting.yml](./.github/workflows/firebase-hosting.yml) выполняет сборку и деплой

### 1. Загрузить проект в GitHub

Создайте новый репозиторий и запушьте туда проект.

### 2. Включить Firebase Hosting

В Firebase Console откройте проект `towtruckdriverauth-300b9` и включите `Hosting`.

### 3. Создать сервисный аккаунт для GitHub Actions

Самый простой официальный путь:

```bash
firebase init hosting:github
```

Либо создайте service account вручную и добавьте его JSON в GitHub Secrets под именем:

```text
FIREBASE_SERVICE_ACCOUNT_TOWTRUCKDRIVERAUTH_300B9
```

Подробности: [Firebase Hosting GitHub integration](https://firebase.google.com/docs/hosting/github-integration)

### 4. Добавить Secrets в GitHub

В репозитории откройте `Settings -> Secrets and variables -> Actions` и добавьте:

- `FIREBASE_SERVICE_ACCOUNT_TOWTRUCKDRIVERAUTH_300B9`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_ADMIN_UID`
- `VITE_DISPATCHER_CANCEL_PASSWORD`

Значения берите из локального `.env.local`.

### 5. Продакшн-деплой

- push в `main` -> деплой в live
- pull request -> preview channel

### 6. Домен и 24/7

Firebase Hosting держит фронтенд доступным круглосуточно. Для своего домена подключите его в разделе `Hosting -> Add custom domain`.

Важно:

- Firestore / Auth / Storage продолжают работать в вашем Firebase-проекте
- Google Maps key должен быть разрешён для прод-домена, не только для `localhost`
- если диспетчерская должна реально использоваться 24/7, нужен как минимум 1 резервный администратор Firebase и контроль лимитов Billing / Firestore

## Альтернативы

Если не Firebase Hosting, тогда нормальные варианты:

- `Vercel`
- `Cloudflare Pages`

Но для этого проекта Firebase Hosting предпочтительнее, потому что весь backend уже на Firebase.
